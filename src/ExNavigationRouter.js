/**
 * @providesModule ExNavigationRouter
 * @flow
 */
/* eslint-disable react/display-name */

import React from 'react';
import UUID from 'uuid-js';

import { EventEmitter } from 'fbemitter';
import invariant from 'invariant';
import warning from 'warning';
import _ from 'lodash';

import { createFocusableComponent } from 'ExNavigationComponents';

import type {
  ExNavigationState,
  ExNavigationConfig,
} from 'ExNavigationTypeDefinition';

type ExNavigationRouteDefinition = (
  (state: ExNavigationState) => React.Element
) | {
  render: (state: ExNavigationState) => React.Element,
  config?: (routeConfig: ExNavigationConfig, routeParams: Object) => ExNavigationConfig,
};

class ExNavigationRoute {
  key: string;
  routeName: string;
  params: Object;
  config: Object;
  _renderRoute: Function;

  render: Function;
  getTitle: Function;

  constructor({ key, routeName, params, config, _renderRoute }) {
    this.key = key;
    this.routeName = routeName;
    this.params = params;
    this.config = config;
    this._renderRoute = _renderRoute;
  }

  render = () => this._renderRoute(this);

  getTitle = () => {
    const title = _.get(this.config, 'navigationBar.title');
    if (typeof title === 'function') {
      return title(this.params, this.config);
    }
    return title;
  };

  getEventEmitter = () => {
    return this.config.eventEmitter;
  };

  clone() {
    return new ExNavigationRoute({
      key: this.key,
      routeName: this.routeName,
      params: this.params,
      config: this.config,
      _renderRoute: this._renderRoute,
    });
  }
}

export class ExNavigationRouter {
  _routes: { [routeName: string]: ExNavigationRouteDefinition };
  _routesCreator: Function;
  _routesCreated: bool;

  constructor(routesCreator: Function) {
    this._routesCreator = routesCreator;
    this._routes = {};
    this._routesCreated = false;
  }

  makeRoute(mapParamsToProps: Function, mapConfigToProps: Function, extraProps: Object = {}) {
    if (!mapParamsToProps) {
      mapParamsToProps = (params) => ({ ...params }); // default, pass all params as props
    }
    if (!mapConfigToProps) {
      mapConfigToProps = (config) => ({}); // default, don't pass any config
    }

    return (RouteComponent: ReactClass): ReactClass => {
      const FocusAwareRouteComponent = createFocusableComponent(RouteComponent);
      FocusAwareRouteComponent.__routeDefinition = ({ params, config }): React.Element => (
        <FocusAwareRouteComponent
          {...mapParamsToProps(params)}
          {...mapConfigToProps(config)}
          {...extraProps}
        />
      );
      return FocusAwareRouteComponent;
    };
  }

  getRoute(routeName: string, routeParams:Object = {}): ExNavigationRoute {
    this._ensureRoute(routeName);

    if (__DEV__) {
      warning(
        _isSerializable(routeParams),
        'You passed a non-serializable value as route parameters. This may prevent navigation state ' +
        'from being saved and restored properly.'
      );
    }

    return this._createRoute(routeName, this._routes[routeName], routeParams);
  }

  updateRouteWithParams(route: ExNavigationRoute, newParams: Object) {
    return this._createRoute(route.routeName, this._routes[route.routeName], { ...route.params, ...newParams });
  }

  _createRoute(routeName: string, routeDefinitionThunk, routeParams: Object = {}): ExNavigationRoute {
    let renderRoute;

    const routeDefinitionOrComponent = routeDefinitionThunk();

    let routeDefinition;
    if (routeDefinitionOrComponent.__routeDefinition) {
      routeDefinition = routeDefinitionOrComponent.__routeDefinition;
    } else {
      routeDefinition = routeDefinitionOrComponent;
    }

    if (typeof routeDefinition === 'function') {
      // no extra definition, just render the component
      renderRoute = routeDefinition;
    } else if (typeof routeDefinition.render === 'function') {
      renderRoute = routeDefinition.render;
    } else {
      throw new Error(
        'Route definition must either be a function that returns a ReactElement, or an object with a `render` function.'
      );
    }

    const _eventEmitter = new EventEmitter();
    const _renderRoute = renderRoute;

    let routeConfig = {
      eventEmitter: _eventEmitter,
    };

    if (routeDefinition.config) {
      if (typeof routeDefinition.config === 'function') {
        routeConfig = {
          ...routeConfig,
          ...routeDefinition.config(routeConfig, routeParams),
        };
      } else {
        routeConfig = {
          ...routeConfig,
          ...routeDefinition.config,
        };
      }
    }

    const route: ExNavigationRoute = new ExNavigationRoute({
      key: UUID.create(4).toString(),
      routeName,
      params: routeParams,
      config: routeConfig,
      _routeDefinition: routeDefinition,
      _renderRoute,
    });

    const routeElement: React.Element = route.render();
    const ComponentClass = routeElement.type;

    if (ComponentClass.navigation) {
      route.config = _.merge({}, route.config, ComponentClass.navigation);
    }

    return route;
  }

  _ensureRoute(routeName: string) {
    if (!this._routesCreated) {
      this._routes = { ...this._routes, ...this._routesCreator() };
      this._routesCreated = true;
    }
    invariant(
      this._routes[routeName],
      `Route '${routeName}' does not exist.`
    );
  }
}

export function createRouter(routesCreator: Function): ExNavigationRouter {
  return new ExNavigationRouter(routesCreator);
}

function _isSerializable(obj: Object): boolean {
  if (_.isUndefined(obj) ||
      _.isNull(obj) ||
      _.isBoolean(obj) ||
      _.isNumber(obj) ||
      _.isString(obj)) {
    return true;
  }

  if (!_.isPlainObject(obj) &&
      !_.isArray(obj)) {
    return false;
  }

  for (var key in obj) {
    if (!_isSerializable(obj[key])) {
      return false;
    }
  }

  return true;
}
