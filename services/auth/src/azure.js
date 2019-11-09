const _ = require('lodash');
const azure = require('fast-azure-storage');
const builder = require('./api');

// keyed by account/tableName, the last time createTable was called for the
// given table.  This is used to avoid lots of redundant calls to createTable
// for the same table.
const tableLastCreated = {};
// Similar for containers
const containerLastCreated = {};

builder.declare({
  method: 'get',
  route: '/azure/accounts',
  name: 'azureAccounts',
  input: undefined,
  output: 'azure-account-list-response.yml',
  stability: 'stable',
  category: 'Auth Service',
  scopes: 'auth:azure-table:list-accounts',
  title: 'List Accounts Managed by Auth',
  description: [
    'Retrieve a list of all Azure accounts managed by Taskcluster Auth.',
  ].join('\n'),
}, function(req, res) {
  return res.reply({accounts: _.keys(this.azureAccounts)});
});

builder.declare({
  method: 'get',
  route: '/azure/:account/table/:table/:level',
  name: 'azureTableSAS',
  input: undefined,
  output: 'azure-table-access-response.yml',
  stability: 'stable',
  category: 'Auth Service',
  scopes: {
    if: 'levelIsReadOnly',
    then: {AnyOf: [
      'auth:azure-table:read-only:<account>/<table>',
      'auth:azure-table:read-write:<account>/<table>',
    ]},
    else: 'auth:azure-table:read-write:<account>/<table>',
  },
  title: 'Get Shared-Access-Signature for Azure Table',
  description: [
    'Get a shared access signature (SAS) string for use with a specific Azure',
    'Table Storage table.',
    '',
    'The `level` parameter can be `read-write` or `read-only` and determines',
    'which type of credentials are returned.  If level is read-write, it will create the',
    'table if it doesn\'t already exist.',
  ].join('\n'),
}, async function(req, res) {
  let account = req.params.account;
  let tableName = req.params.table;
  let level = req.params.level;

  // We have a complicated scope situation for read-only since we want
  // read-write to grant read-only permissions as well
  await req.authorize({
    account,
    table: tableName,
    level,
    levelIsReadOnly: level === 'read-only',
  });

  // Check that the account exists
  if (!this.azureAccounts[account]) {
    return res.reportError('ResourceNotFound',
      `Account '${account}' not found, can't delegate access`);
  }

  // Construct client
  let table = new azure.Table({
    accountId: account,
    accessKey: this.azureAccounts[account],
  });

  // Create table, ignore error, if it already exists
  if (level === 'read-write') {
    // only try to create if we haven't done so in this process recently
    const key = `${account}/${tableName}`;
    if (!tableLastCreated[key] || new Date() - tableLastCreated[key] > 6 * 3600 * 1000) {
      try {
        await table.createTable(tableName);
      } catch (err) {
        if (err.code !== 'TableAlreadyExists') {
          throw err;
        }
      }
      tableLastCreated[key] = new Date();
    }
  }

  let perm = false; // We no longer allow writing to azure

  // Construct SAS
  let expiry = new Date(Date.now() + 25 * 60 * 1000);
  let sas = table.sas(tableName, {
    start: new Date(Date.now() - 15 * 60 * 1000),
    expiry: expiry,
    permissions: {
      read: true,
      add: perm,
      update: perm,
      delete: perm,
    },
  });

  // Return the generated SAS
  return res.reply({
    sas: sas,
    expiry: expiry.toJSON(),
  });
});

builder.declare({
  method: 'get',
  route: '/azure/:account/tables',
  name: 'azureTables',
  query: {
    continuationToken: /^.*$/,
  },
  input: undefined,
  category: 'Auth Service',
  output: 'azure-table-list-response.yml',
  stability: 'stable',
  scopes: 'auth:azure-table:list-tables:<account>',
  title: 'List Tables in an Account Managed by Auth',
  description: [
    'Retrieve a list of all tables in an account.',
  ].join('\n'),
}, async function(req, res) {
  let account = req.params.account;
  let continuationToken = req.query.continuationToken || null;

  let table = new azure.Table({
    accountId: account,
    accessKey: this.azureAccounts[account],
  });

  let result = await table.queryTables({nextTableName: continuationToken});
  let data = {tables: result.tables};
  if (result.nextTableName) {
    data.continuationToken = result.nextTableName;
  }
  return res.reply(data);
});

builder.declare({
  method: 'get',
  route: '/azure/:account/containers',
  name: 'azureContainers',
  query: {
    continuationToken: /.*/,
  },
  input: undefined,
  output: 'azure-container-list-response.yml',
  stability: 'stable',
  category: 'Auth Service',
  scopes: 'auth:azure-container:list-containers:<account>',
  title: 'List containers in an Account Managed by Auth',
  description: [
    'Retrieve a list of all containers in an account.',
  ].join('\n'),
}, async function(req, res) {
  let account = req.params.account;
  let continuationToken = req.query.continuationToken || null;

  let blob = new azure.Blob({
    accountId: account,
    accessKey: this.azureAccounts[account],
  });

  let result = await blob.listContainers({marker: continuationToken});
  let data = {containers: result.containers.map(c => c.name)};
  if (result.nextMarker) {
    data.continuationToken = result.nextMarker;
  }
  return res.reply(data);
});

