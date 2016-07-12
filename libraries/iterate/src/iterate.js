let _ = require('lodash');
let assert = require('assert');
let WatchDog = require('./watchdog');
let debug = require('debug')('iterate');
let request = require('request-promise');
let events = require('events');


/**
 * Run a handler many times.  Monitor the handler to make sure that it fails loudly
 * when it fails, but tries to succeed more than once before killing itself.
 *
 * Options:
 *   * 
 * 
 * Emits:
 *   * 'started': when overall iteration starts
 *   * 'stopped': when overall iteration is finished
 *   * 'completed': only when we have a max number of iterations, when we finish the last iteration
 *   * 'iteration-start': when an individual iteration starts
 *   * 'iteration-complete': when an individual iteration completes with success.
 *     provides the value that handler resolves with
 *   * 'iteration-error': provides iteration error
 *   * 'waiting': when we start waiting for the next iteration
 *   * 'error': when the iteration is considered to be concluded and provides
 *     list of iteration errors.  If there are no handlers and this event is
 *     emitted, an exception will be thrown in a process.nextTick callback.
 */
class Iterate extends events.EventEmitter {
  constructor(opts) {
    super();
    events.EventEmitter.call(this);

    assert(typeof (opts.maxIterations || 0) === 'number', 'maxIterations must be number');
    this.maxIterations = opts.maxIterations || 0;

    assert(typeof (opts.maxFailures || 7) === 'number', 'maxFailures must be number');
    this.maxFailures = opts.maxFailures || 7;

    assert(typeof opts.maxIterationTime === 'number', 'maxIterationTime must be number');
    this.maxIterationTime = opts.maxIterationTime * 1000;

    assert(typeof (opts.minIterationTime || 0) === 'number', 'minIterationTime must be number');
    this.minIterationTime = opts.minIterationTime * 1000 || 0;

    assert(typeof opts.watchDog === 'number', 'watchDog must be number');
    this.watchDogTime = opts.watchDog * 1000;

    assert(typeof opts.waitTime === 'number', 'waitTime must be number');
    this.waitTime = opts.waitTime * 1000;

    assert(typeof (opts.waitTimeAfterFail || 0) === 'number', 'waitTimeAfterFail must be number');
    this.waitTimeAfterFail = opts.waitTimeAfterFail || opts.waitTime;

    // Not sure if the deep
    assert(typeof opts.handler === 'function', 'handler must be a function');
    this.handler = opts.handler;

    assert(typeof (opts.dmsConfig || {}) === 'object', 'dmsConfig must be object');
    this.dmsConfig = opts.dmsConfig || null;
    if (this.dmsConfig) {
      assert(typeof this.dmsConfig === 'object');
      assert(typeof this.dmsConfig.snitchUrl === 'string');
      assert(typeof this.dmsConfig.apiKey === 'string');
    }

    // We add the times together since we're always going to have the watch dog
    // running even when we're waiting for the next iteration
    this.overallWatchDog = new WatchDog(this.maxIterationTime + this.waitTime);
    this.incrementalWatchDog = new WatchDog(this.watchDogTime);

    this.overallWatchDog.on('expired', () => {
      this.failures.push(new Error(`maxIterationTime of ${this.maxIterationTime} exceeded`));
      this.__emitFatalError();
    });

    this.incrementalWatchDog.on('expired', () => {
      this.failures.push(new Error(`watchDog of ${this.watchDogTime} exceeded`));
      this.__emitFatalError();
    });

    // Count the iteration that we're on.
    this.currentIteration = 0;
    this.keepGoing = false;

    // Store the list of exceptions of the last few iterations
    this.failures = [];

    // We want to be able to share state between iterations
    this.sharedState = {};
  }

  async iterate() {
    // We only run this watch dog for the actual iteration loop
    this.emit('iteration-started');
    this.incrementalWatchDog.start();

    // Run the handler, pass in shared state so iterations can refer to
    // previous iterations without being too janky
    try {
      debug('running handler');
      let start = new Date();

      // Note that we're using a watch dog for the maxIterationTime guarding.
      // The overallWatchDog timer is the absolute upper bounds for this
      // iteration, this watchdog is the one to check things are still
      // happening in the handler.
      let value = await this.handler(this.incrementalWatchDog, this.sharedState);
      // TODO: do this timing the better way
      let diff = (new Date() - start) / 1000;
      this.emit('iteration-complete', value);
      debug(`ran handler in ${diff} seconds`);

      // Let's check that if we have a minimum threshold for handler activity
      // time, that we exceed it
      if (this.minIterationTime > 0 && diff < this.minIterationTime) {
        throw new Error('Minimum threshold for handler execution not met');
      }

      // We could probably safely just create a new Array every time since if
      // we get to this point we want to reset the Array unconditionally, but I
      // don't have timing on the costs... premature optimization!
      if (this.failures.length > 0) {
        this.failures = [];
      }
    } catch (err) {
      this.emit('iteration-error', err);
      debug('experienced iteration failure');
      this.failures.push(err);
    }

    // We don't wand this watchdog timer to always run
    this.incrementalWatchDog.stop();

    if (this.failures.length > this.maxFailures) {
      this.__emitFatalError();
    }

    // TODO: double check this isn't an off by one
    // When we reach the end of a set number of iterations, we'll stop
    if (this.maxIterations > 0 && this.maxIterations <= this.currentIteration + 1) {
      debug(`reached max iterations of ${this.maxIterations}`);
      this.emit('completed');
      this.stop();
    }

    // Hit the dead man's snitch
    if (this.dmsConfig) {
      try {
        debug('hitting deadman\'s snitch');
        let result = await request.get(this.dmsConfig.snitchUrl, {
          auth: {
            username: this.dmsConfig.apiKey,
            password: '',
            sendImmediately: true,
          }
        });
        debug('hit deadman\'s snitch');
      } catch (err) {
        debug(`error hitting deadman's snitch ${err.stack || err}`);
      }
    }

    if (this.keepGoing) {
      debug('scheduling next iteration');
      this.overallWatchDog.touch();
      this.currentIteration++;
      setTimeout(async () => {
        try {
          await this.iterate();
        } catch (err) {
          console.error(err.stack || err);
        }
      }, this.waitTime);
    } else {
      this.stop();
    }
  }

  /** 
   * Special function which knows how to emit the final error and then throw an
   * unhandled exception where appropriate.  Also stop trying to iterate
   * further.
   */
  __emitFatalError() {
    this.stop();
    if (this.listeners('error').length > 0) {
      this.emit('error', this.failures);
    } else {
      debug('fatal error:');
      for (let x of this.failures) {
        debug(`  * ${x.stack || x}`);
      }
      debug('trying to crash process');
      process.nextTick(() => {
        throw new Error(`Errors:\n=====${this.failures.map(x => x.stack || x).join('\n')}`);
      });
    }
  }

  start() {
    debug('starting');
    this.keepGoing = true;
    this.overallWatchDog.start();

    // Two reasons we call it this way:
    //   1. first call should have same exec env as following
    //   2. start should return immediately
    setTimeout(async () => {
      debug('starting iteration');
      this.emit('started');
      try {
        await this.iterate();
      } catch (err) {
        console.error(err.stack || err);
      }
    }, 0);
  }

  stop() {
    this.overallWatchDog.stop();
    this.keepGoing = false;
    this.currentIteration = 0;
    this.emit('stopped');
    debug('stopped');
  }

}

module.exports = Iterate;