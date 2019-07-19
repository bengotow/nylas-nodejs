import isFunction from 'lodash/isFunction';

import Attributes, { Attribute } from './attributes';
import NylasConnection from '../nylas-connection'

export type SaveCallback = (error: Error | null, result?: RestfulModel) => void

type RestfulModelJSON = {
  id: string;
  object: string ;
  accountId: string;
  [key: string]: any;
}

export default class RestfulModel {
  static endpointName: string = ''; // overrridden in subclasses
  static collectionName: string = ''; // overrridden in subclasses
  static attributes: {[key: string]: Attribute};

  connection: NylasConnection;
  id: string = '';
  object: string = '';
  accountId: string = '';

  constructor(connection: NylasConnection, json?: Partial<RestfulModelJSON>) {
    this.connection = connection;
    if (!(this.connection instanceof require('../nylas-connection'))) {
      throw new Error('Connection object not provided');
    }
    if (json) {
      this.fromJSON(json);
    }
  }

  attributes() : {[key: string]: Attribute} {
    return (this.constructor as any).attributes;
  }

  isEqual(other: RestfulModel) {
    return (
      (other ? other.id : undefined) === this.id &&
      (other ? other.constructor : undefined) === this.constructor
    );
  }

  fromJSON(json: Partial<RestfulModelJSON> = {}) {
    const attributes = this.attributes();
    for (const attrName in attributes) {
      const attr = attributes[attrName];
      if (json[attr.jsonKey] !== undefined) {
        (this as any)[attrName] = attr.fromJSON(json[attr.jsonKey], this);
      }
    }
    return this;
  }

  toJSON() {
    const json: any = {};
    const attributes = this.attributes();
    for (const attrName in attributes) {
      const attr = attributes[attrName];
      json[attr.jsonKey] = attr.toJSON((this as any)[attrName]);
    }
    json['object'] = this.constructor.name.toLowerCase();
    return json;
  }

  // saveRequestBody is used by save(). It returns a JSON dict containing only the
  // fields the API allows updating. Subclasses should override this method.
  saveRequestBody() {
    return this.toJSON();
  }

  toString() {
    return JSON.stringify(this.toJSON());
  }

  // Not every model needs to have a save function, but those who
  // do shouldn't have to reimplement the same boilerplate.
  // They should instead define a save() function which calls _save.
  _save(params: SaveCallback | {} = {}, callback?: SaveCallback) {
    if (isFunction(params)) {
      callback = params as SaveCallback;
      params = {};
    }
    const collectionName = (this.constructor as any).collectionName

    return this.connection
      .request({
        method: this.id ? 'PUT' : 'POST',
        body: this.saveRequestBody(),
        qs: params,
        path: this.id
          ? `/${collectionName}/${this.id}`
          : `/${collectionName}`,
      })
      .then(json => {
        this.fromJSON(json as RestfulModelJSON);
        if (callback) {
          callback(null, this);
        }
        return Promise.resolve(this);
      })
      .catch(err => {
        if (callback) {
          callback(err);
        }
        return Promise.reject(err);
      });
  }

  _get(params = {}, callback = null, path_suffix = '') {
    const collectionName = (this.constructor as any).collectionName
    return this.connection
      .request({
        method: 'GET',
        path: `/${collectionName}/${this.id}${path_suffix}`,
        qs: params,
      })
      .then(response => {
        // todo bg: this does not call it's callback at all!
        return Promise.resolve(response);
      });
  }
}

(RestfulModel as any).attributes = {
  id: Attributes.String({
    modelKey: 'id',
  }),
  object: Attributes.String({
    modelKey: 'object',
  }),
  accountId: Attributes.String({
    modelKey: 'accountId',
    jsonKey: 'account_id',
  }),
};
