const MonitorBuilder = require('taskcluster-lib-monitor');

const builder = new MonitorBuilder({
  projectName: 'taskcluster-web-server',
});

module.exports = builder;
