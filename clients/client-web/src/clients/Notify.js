// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.

import Client from '../Client';

export default class Notify extends Client {
  constructor(options = {}) {
    super({
      serviceName: 'notify',
      serviceVersion: 'v1',
      exchangePrefix: '',
      ...options,
    });
    this.ping.entry = {"args":[],"category":"Ping Server","method":"get","name":"ping","query":[],"route":"/ping","stability":"stable","type":"function"}; // eslint-disable-line
    this.email.entry = {"args":[],"category":"Notifications","input":true,"method":"post","name":"email","query":[],"route":"/email","scopes":"notify:email:<address>","stability":"experimental","type":"function"}; // eslint-disable-line
    this.pulse.entry = {"args":[],"category":"Notifications","input":true,"method":"post","name":"pulse","query":[],"route":"/pulse","scopes":"notify:pulse:<routingKey>","stability":"experimental","type":"function"}; // eslint-disable-line
    this.irc.entry = {"args":[],"category":"Notifications","input":true,"method":"post","name":"irc","query":[],"route":"/irc","scopes":{"else":"notify:irc-user:<user>","if":"channelRequest","then":"notify:irc-channel:<channel>"},"stability":"experimental","type":"function"}; // eslint-disable-line
    this.addDenylistAddress.entry = {"args":[],"category":"Denylist","input":true,"method":"post","name":"addDenylistAddress","query":[],"route":"/denylist/add","scopes":"notify:manage-denylist","stability":"experimental","type":"function"}; // eslint-disable-line
    this.deleteDenylistAddress.entry = {"args":[],"category":"Denylist","input":true,"method":"delete","name":"deleteDenylistAddress","query":[],"route":"/denylist/delete","scopes":"notify:manage-denylist","stability":"experimental","type":"function"}; // eslint-disable-line
    this.listDenylist.entry = {"args":[],"category":"Denylist","method":"get","name":"listDenylist","output":true,"query":["continuationToken","limit"],"route":"/denylist/list","scopes":"notify:manage-denylist","stability":"experimental","type":"function"}; // eslint-disable-line
  }
  /* eslint-disable max-len */
  // Respond without doing anything.
  // This endpoint is used to check that the service is up.
  /* eslint-enable max-len */
  ping(...args) {
    this.validate(this.ping.entry, args);

    return this.request(this.ping.entry, args);
  }
  /* eslint-disable max-len */
  // Send an email to `address`. The content is markdown and will be rendered
  // to HTML, but both the HTML and raw markdown text will be sent in the
  // email. If a link is included, it will be rendered to a nice button in the
  // HTML version of the email
  /* eslint-enable max-len */
  email(...args) {
    this.validate(this.email.entry, args);

    return this.request(this.email.entry, args);
  }
  /* eslint-disable max-len */
  // Publish a message on pulse with the given `routingKey`.
  /* eslint-enable max-len */
  pulse(...args) {
    this.validate(this.pulse.entry, args);

    return this.request(this.pulse.entry, args);
  }
  /* eslint-disable max-len */
  // Post a message on IRC to a specific channel or user, or a specific user
  // on a specific channel.
  // Success of this API method does not imply the message was successfully
  // posted. This API method merely inserts the IRC message into a queue
  // that will be processed by a background process.
  // This allows us to re-send the message in face of connection issues.
  // However, if the user isn't online the message will be dropped without
  // error. We maybe improve this behavior in the future. For now just keep
  // in mind that IRC is a best-effort service.
  /* eslint-enable max-len */
  irc(...args) {
    this.validate(this.irc.entry, args);

    return this.request(this.irc.entry, args);
  }
  /* eslint-disable max-len */
  // Add the given address to the notification denylist. The address
  // can be of either of the three supported address type namely pulse, email
  // or IRC(user or channel). Addresses in the denylist will be ignored
  // by the notification service.
  /* eslint-enable max-len */
  addDenylistAddress(...args) {
    this.validate(this.addDenylistAddress.entry, args);

    return this.request(this.addDenylistAddress.entry, args);
  }
  /* eslint-disable max-len */
  // Delete the specified address from the notification denylist.
  /* eslint-enable max-len */
  deleteDenylistAddress(...args) {
    this.validate(this.deleteDenylistAddress.entry, args);

    return this.request(this.deleteDenylistAddress.entry, args);
  }
  /* eslint-disable max-len */
  // Lists all the denylisted addresses.
  // By default this end-point will try to return up to 1000 addresses in one
  // request. But it **may return less**, even if more tasks are available.
  // It may also return a `continuationToken` even though there are no more
  // results. However, you can only be sure to have seen all results if you
  // keep calling `list` with the last `continuationToken` until you
  // get a result without a `continuationToken`.
  // If you are not interested in listing all the members at once, you may
  // use the query-string option `limit` to return fewer.
  /* eslint-enable max-len */
  listDenylist(...args) {
    this.validate(this.listDenylist.entry, args);

    return this.request(this.listDenylist.entry, args);
  }
}
