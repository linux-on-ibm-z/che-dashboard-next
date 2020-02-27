// import {CheJsonRpcApiClient} from './che-json-rpc-api-service';
// import {ICommunicationClient} from './json-rpc-client';
// import {Keycloak} from '../keycloak/Keycloak';
//
// enum MasterChannels {
//   ENVIRONMENT_OUTPUT = <any>'runtime/log',
//   ENVIRONMENT_STATUS = <any>'machine/statusChanged',
//   WS_AGENT_OUTPUT = <any>'installer/log',
//   WORKSPACE_STATUS = <any>'workspace/statusChanged',
//   ORGANIZATION_STATUS = <any>'organization/statusChanged',
//   ORGANIZATION_MEMBERSHIP_STATUS = <any>'organization/membershipChanged'
// }
//
// enum MasterScopes {
//   ORGANIZATION = <any>'organizationId',
//   USER = <any>'userId',
//   WORKSPACE = <any>'workspaceId'
// }
//
// const SUBSCRIBE: string = 'subscribe';
// const UNSUBSCRIBE: string = 'unsubscribe';
//
// /**
//  * Client API for workspace master interactions
//  */
// export class CheJsonRpcMasterApi {
//   private $log: ng.ILogService;
//   private $timeout: ng.ITimeoutService;
//   private $interval: ng.IIntervalService;
//   private $q: ng.IQService;
//   private cheKeycloak: Keycloak;
//   private cheJsonRpcApi: CheJsonRpcApiClient;
//   private clientId: string;
//   private checkingInterval: ng.IPromise<any>;
//   private reconnectionAttemptTimeout: ng.IPromise<any>;
//
//   private maxReconnectionAttempts = 100;
//   private reconnectionAttemptNumber = 0;
//   private reconnectionDelay = 30000;
//   private checkingDelay = 10000;
//   private fetchingClientIdTimeout = 5000;
//
//   constructor(
//     client: ICommunicationClient,
//     entrypoint: string,
//     $log: ng.ILogService,
//     $timeout: ng.ITimeoutService,
//     $interval: ng.IIntervalService,
//     $q: ng.IQService,
//     cheKeycloak: CheKeycloak
//   ) {
//     this.$log = $log;
//     this.$timeout = $timeout;
//     this.$interval = $interval;
//     this.$q = $q;
//     this.cheKeycloak = cheKeycloak;
//
//     client.addListener('open', () => this.onConnectionOpen(entrypoint));
//     client.addListener('close', () => this.onConnectionClose(entrypoint));
//
//     this.cheJsonRpcApi = new CheJsonRpcApiClient(client);
//     this.connect(entrypoint);
//   }
//
//   onConnectionOpen(entrypoint: string): void {
//     if (this.reconnectionAttemptNumber !== 0) {
//       this.$log.log('WebSocket connection is opened.');
//     }
//     this.reconnectionAttemptNumber = 0;
//
//     if (this.checkingInterval) {
//       this.$interval.cancel(this.checkingInterval);
//     }
//     if (this.reconnectionAttemptTimeout) {
//       this.$timeout.cancel(this.reconnectionAttemptTimeout);
//       this.reconnectionAttemptTimeout = undefined;
//     }
//
//     this.checkingInterval = this.$interval(() => {
//       if (this.reconnectionAttemptTimeout) {
//         return;
//       }
//
//       let isAlive = false;
//       const fetchClientPromise = this.fetchClientId().then(() => {
//         isAlive = true;
//         return isAlive;
//       }, (error: any) => {
//         this.$log.error(error);
//         isAlive = false;
//         return isAlive;
//       });
//
//       // this is timeout of fetchClientId request
//       const fetchClientTimeout = this.$timeout(() => {
//         return isAlive;
//       }, this.fetchingClientIdTimeout);
//
//       this.promisesRace([fetchClientPromise, fetchClientTimeout]).then((isAlive: boolean) => {
//         if (isAlive) {
//           return;
//         }
//
//         this.reconnect(entrypoint);
//       });
//
//     }, this.checkingDelay);
//   }
//
//   onConnectionClose(entrypoint: string): void {
//     this.reconnect(entrypoint);
//   }
//
//   reconnect(entrypoint: string): void {
//     this.$log.warn('WebSocket connection is closed.');
//     if (this.reconnectionAttemptNumber === this.maxReconnectionAttempts) {
//       this.$log.warn('The maximum number of attempts to reconnect WebSocket has been reached.');
//
//       if (this.checkingInterval) {
//         this.$interval.cancel(this.checkingInterval);
//       }
//
//       return;
//     }
//
//     this.reconnectionAttemptNumber++;
//     // let very first reconnection happens immediately after the connection is closed.
//     const delay = this.reconnectionAttemptNumber === 1 ? 0 : this.reconnectionDelay;
//
//     if (delay) {
//       this.$log.warn(`WebSocket will be reconnected in ${delay} ms...`);
//     }
//     this.reconnectionAttemptTimeout = this.$timeout(() => {
//       this.$log.warn(`WebSocket is reconnecting, attempt #${this.reconnectionAttemptNumber} out of ${this.maxReconnectionAttempts}...`);
//       this.connect(entrypoint);
//     }, delay);
//   }
//
//   /**
//    * Opens connection to pointed entrypoint
//    */
//   connect(entrypoint: string): ng.IPromise<void> {
//     return this.refreshToken()
//       .then(() => this.addQueryParams(entrypoint))
//       .then((entrypointWithParams: string) => this.cheJsonRpcApi.connect(entrypointWithParams))
//       .then(() => this.fetchClientId());
//   }
//
//   private refreshToken(): ng.IPromise<void> {
//     const defer = this.$q.defer<void>();
//
//     if (this.cheKeycloak.isPresent()) {
//       this.cheKeycloak.keycloak.updateToken(5).success(() => {
//         defer.resolve();
//       }).error(() => {
//         this.$log.warn('Failed to refresh token.');
//         defer.resolve();
//       });
//     } else {
//       defer.resolve();
//     }
//     return defer.promise;
//   }
//
//   private addQueryParams(entrypoint: string): string {
//     const params: string[] = [];
//     if (this.cheKeycloak.isPresent()) {
//       params.push(`token=${this.cheKeycloak.keycloak.token}`);
//     }
//     if (this.clientId) {
//       params.push(`clientId=${this.clientId}`);
//     }
//
//     if (params.length === 0) {
//       return entrypoint;
//     }
//
//     const queryStr = params.join('&');
//     if (/\?/.test(entrypoint) === false) {
//       return entrypoint + '?' + queryStr;
//     } else {
//       return entrypoint + '&' + queryStr;
//     }
//   }
//
//   /**
//    * Subscribes the environment output.
//    */
//   subscribeEnvironmentOutput(workspaceId: string, callback: Function): void {
//     this.subscribe(MasterChannels.ENVIRONMENT_OUTPUT, MasterScopes.WORKSPACE, workspaceId, callback);
//   }
//
//   /**
//    * Un-subscribes the pointed callback from the environment output
//    */
//   unSubscribeEnvironmentOutput(workspaceId: string, callback: Function): void {
//     this.unsubscribe(MasterChannels.ENVIRONMENT_OUTPUT, MasterScopes.WORKSPACE, workspaceId, callback);
//   }
//
//   /**
//    * Subscribes the environment status changed
//    */
//   subscribeEnvironmentStatus(workspaceId: string, callback: Function): void {
//     this.subscribe(MasterChannels.ENVIRONMENT_STATUS, MasterScopes.WORKSPACE, workspaceId, callback);
//   }
//
//   /**
//    * Un-subscribes the pointed callback from environment status changed
//    */
//   unSubscribeEnvironmentStatus(workspaceId: string, callback: Function): void {
//     this.unsubscribe(MasterChannels.ENVIRONMENT_STATUS, MasterScopes.WORKSPACE, workspaceId, callback);
//   }
//
//   /**
//    * Subscribes on workspace agent output
//    */
//   subscribeWsAgentOutput(workspaceId: string, callback: Function): void {
//     this.subscribe(MasterChannels.WS_AGENT_OUTPUT, MasterScopes.WORKSPACE, workspaceId, callback);
//   }
//
//   /**
//    * Un-subscribes from workspace agent output
//    */
//   unSubscribeWsAgentOutput(workspaceId: string, callback: Function): void {
//     this.unsubscribe(MasterChannels.WS_AGENT_OUTPUT, MasterScopes.WORKSPACE, workspaceId, callback);
//   }
//
//   /**
//    * Subscribes to workspace's status
//    */
//   subscribeWorkspaceStatus(workspaceId: string, callback: Function): void {
//     let statusHandler = (message: any) => {
//       if (workspaceId === message.workspaceId) {
//         callback(message);
//       }
//     };
//     this.subscribe(MasterChannels.WORKSPACE_STATUS, MasterScopes.WORKSPACE, workspaceId, statusHandler);
//   }
//
//   /**
//    * Un-subscribes pointed callback from workspace's status
//    */
//   unSubscribeWorkspaceStatus(workspaceId: string, callback: Function): void {
//     this.unsubscribe(MasterChannels.WORKSPACE_STATUS, MasterScopes.WORKSPACE, workspaceId, callback);
//   }
//
//   /**
//    * Subscribe to organization statuses
//    */
//   subscribeOrganizationStatus(organizationId: string, callback: Function): void {
//     this.subscribe(MasterChannels.ORGANIZATION_STATUS, MasterScopes.ORGANIZATION, organizationId, callback);
//   }
//
//   /**
//    * Un-subscribe from organization status changes
//    */
//   unSubscribeOrganizationStatus(organizationId: string, callback?: Function): void {
//     this.unsubscribe(MasterChannels.ORGANIZATION_STATUS, MasterScopes.ORGANIZATION, organizationId, callback);
//   }
//
//   /**
//    * Subscribe to organization membership changes
//    */
//   subscribeOrganizationMembershipStatus(userId: string, callback: Function): void {
//     this.subscribe(MasterChannels.ORGANIZATION_MEMBERSHIP_STATUS, MasterScopes.USER, userId, callback);
//   }
//
//   /**
//    * Un-subscribe from organization membership changes
//    */
//   unSubscribeOrganizationMembershipStatus(userId: string, callback: Function): void {
//     this.unsubscribe(MasterChannels.ORGANIZATION_MEMBERSHIP_STATUS, MasterScopes.USER, userId, callback);
//   }
//
//   /**
//    * Fetch client's id and strores it
//    */
//   fetchClientId(): ng.IPromise<void> {
//     return this.cheJsonRpcApi.request('websocketIdService/getId').then((data: any) => {
//       this.clientId = data[0];
//     });
//   }
//
//   /**
//    * Returns client's id
//    */
//   getClientId(): string {
//     return this.clientId;
//   }
//
//   /**
//    * Performs subscribe to the pointed channel for pointed workspace's ID and callback.
//    *
//    * @param channel channel to un-subscribe
//    * @param _scope the scope of the request
//    * @param id instance's id (scope value)
//    * @param callback callback
//    */
//   private subscribe(channel: MasterChannels, _scope: MasterScopes, id: string, callback: Function): void {
//     let method: string = channel.toString();
//     let masterScope: string = _scope.toString();
//     let params = {method: method, scope: {}};
//     params.scope[masterScope] = id;
//     this.cheJsonRpcApi.subscribe(SUBSCRIBE, method, callback, params);
//   }
//
//   /**
//    * Performs un-subscribe of the pointed channel by pointed workspace's ID and callback
//    */
//   private unsubscribe(channel: MasterChannels, _scope: MasterScopes, id: string, callback: Function): void {
//     let method: string = channel.toString();
//     let masterScope: string = _scope.toString();
//     let params = {method: method, scope: {}};
//     params.scope[masterScope] = id;
//     this.cheJsonRpcApi.unsubscribe(UNSUBSCRIBE, method, callback, params);
//   }
//
//   private promisesRace(promises: ng.IPromise<any>[]): ng.IPromise<any> {
//     const deferred = this.$q.defer();
//
//     promises.forEach((promise: ng.IPromise<any>) => {
//       promise.then(deferred.resolve, deferred.reject);
//     });
//
//     return deferred.promise;
//   }
// }