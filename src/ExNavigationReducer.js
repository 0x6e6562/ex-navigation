/**
 * @providesModule ExNavigationReducer
 */

import _ from 'lodash';

// import {
//   NavigationExperimental,
// } from 'react-native';

import invariant from 'invariant';

import ActionTypes from 'ExNavigationActionTypes';

const {
  StateUtils: NavigationStateUtils,
} = require('VendoredNavigationExperimental');

const INITIAL_STATE = {
  navigators: {},
  currentNavigatorUID: null,
};

let navigatorsToRestore = [];

class ExNavigationReducer {
  static reduce(state = null, action) {
    if (!ExNavigationReducer[action.type]) {
      return state;
    }
    const newState = ExNavigationReducer[action.type](state, action);
    return newState;
  }

  static [ActionTypes.INITIALIZE](state, action) {
    return INITIAL_STATE;
  }

  static [ActionTypes.SET_CURRENT_NAVIGATOR](state, { navigatorUID, parentNavigatorUID, navigatorType, defaultRouteConfig, routes, index }) {
    if (!state.navigators[navigatorUID] && !routes) {
      return state;
    }

    let newState = {
      currentNavigatorUID: navigatorUID,
    };

    if (routes) {
      const navigatorState = state.navigators[navigatorUID];
      routes = routes.map(child => {
        if (child.clone) {
          const newChild = child.clone();
          newChild.config = _.merge({}, defaultRouteConfig, child.config);
          return newChild;
        } else {
          return child;
        }
      });
      newState = {
        ...newState,
        navigators: {
          ...state.navigators,
          [navigatorUID]: {
            routes: routes,
            index: index,
            ...(parentNavigatorUID ? { parentNavigatorUID } : null),
            defaultRouteConfig,
            type: navigatorType,
          },
        },
      };
    }

    return {
      ...state,
      ...newState,
    };
  }

  static [ActionTypes.REMOVE_NAVIGATOR](state, { navigatorUID }) {
    const currentNavigatorUID = (navigatorsToRestore.length && navigatorsToRestore[navigatorsToRestore.length - 1]) ||
      state.navigators[navigatorUID].parentNavigatorUID;
    navigatorsToRestore.pop();
    return {
      ...state,
      currentNavigatorUID,
      navigators: _.omit(state.navigators, navigatorUID),
    };
  }

  static [ActionTypes.PUSH](state, { navigatorUID, child }) {
    const navigatorState = state.navigators[navigatorUID] || {
      routes: [],
      key: navigatorUID,
      index: 0,
      defaultRouteConfig: {},
      type: 'stack',
    };

    if (navigatorUID !== state.currentNavigatorUID) {
      navigatorsToRestore.push(state.currentNavigatorUID);
    }

    const defaultRouteConfig = navigatorState.defaultRouteConfig;

    const newChild = child.clone();
    newChild.config = _.merge({}, defaultRouteConfig, child.config);

    return {
      ..._updateNavigator(state, navigatorUID, NavigationStateUtils.push(navigatorState, newChild)),
      currentNavigatorUID: navigatorUID,
    };
  }

  static [ActionTypes.POP](state, { navigatorUID }) {
    invariant(state.navigators[navigatorUID], 'Navigator does not exist.');
    const navigatorState = state.navigators[navigatorUID];

    if (navigatorState.index === 0) {
      return state;
    }

    return _updateNavigator(state, navigatorUID, NavigationStateUtils.pop(navigatorState));
  }

  static [ActionTypes.SHOW_LOCAL_ALERT_BAR](state, { navigatorUID, message, options }) {
    let navigatorState = {
      ...state.navigators[navigatorUID],
      alert: {
        message,
        options,
      },
    };

    return {
      ..._updateNavigator(state, navigatorUID, navigatorState),
    };
  }

  static [ActionTypes.HIDE_LOCAL_ALERT_BAR](state, { navigatorUID }) {
    let previousNavigatorState = state.navigators[navigatorUID];
    let navigatorState = {
      ...state.navigators[navigatorUID],
      alert: null,
    };

    return {
      ..._updateNavigator(state, navigatorUID, navigatorState),
    };
  }

  static [ActionTypes.TOGGLE_DRAWER](state, { navigatorUID }) {
    invariant(state.navigators[navigatorUID], 'Navigator does not exist.');
    const navigatorState = state.navigators[navigatorUID];

    if (navigatorState.index === 0) {
      return state;
    }

    return _updateNavigator(state, navigatorUID, NavigationStateUtils.pop(navigatorState));
  }

  static [ActionTypes.IMMEDIATELY_RESET_STACK](state, { navigatorUID, routes, index }) {
    console.log({ navigatorUID, routes, index });
    const navigatorState = state.navigators[navigatorUID] || {
      routes: [],
      index: 0,
      key: navigatorUID,
      defaultRouteConfig: {},
      type: 'stack',
    };

    const defaultRouteConfig = navigatorState.defaultRouteConfig;

    const newChildren = routes.map(child => {
      const newChild = child.clone();
      newChild.config = _.merge({}, defaultRouteConfig, child.config);
      return newChild;
    });

    return {
      ..._updateNavigator(state, navigatorUID, NavigationStateUtils.reset(navigatorState, newChildren, index)),
      currentNavigatorUID: navigatorUID,
    };
  }

  static [ActionTypes.UPDATE_ROUTE_AT_INDEX](state, { navigatorUID, index, newRoute }) {
    invariant(state.navigators[navigatorUID], 'Navigator does not exist.');
    const navigatorState = state.navigators[navigatorUID];
    return _updateNavigator(state, navigatorUID, NavigationStateUtils.replaceAtIndex(navigatorState, index, newRoute));
  }

  static [ActionTypes.JUMP_TO_ITEM](state, { navigatorUID, item }) {
    invariant(state.navigators[navigatorUID], 'Navigator does not exist.');
    invariant(state.navigators[navigatorUID].type === 'drawer', 'Navigator is not drawer navigator.');
    return _updateSelectedKey(item, state, navigatorUID);
  }

  static [ActionTypes.JUMP_TO_TAB](state, { navigatorUID, tab }) {
    invariant(state.navigators[navigatorUID], 'Navigator does not exist.');
    invariant(state.navigators[navigatorUID].type === 'tab', 'Navigator is not tab navigator.');
    return _updateSelectedKey(tab, state, navigatorUID);
  }
}

export default ExNavigationReducer.reduce;

function _updateSelectedKey(target, state, navigatorUID) {
  const newNavigatorState = { ...state.navigators[navigatorUID] };
  const selected = newNavigatorState.routes[newNavigatorState.index];

  if (target.key === selected.key) { // haven't changed sections
    return state;
  }

  let targetIndex = NavigationStateUtils.indexOf(newNavigatorState, target.key);
  if (targetIndex !== -1) {
    const old = newNavigatorState.routes[targetIndex];
    newNavigatorState.routes.splice(targetIndex, 1);
    newNavigatorState.routes.push(old);
  } else {
    newNavigatorState.routes.push(target);
  }

  newNavigatorState.index = newNavigatorState.routes.length - 1;

  return {
    ..._updateNavigator(state, navigatorUID, newNavigatorState),
    currentNavigatorUID: navigatorUID,
  };
}

function _updateNavigator(state, navigatorUID, newState) {
  return {
    ...state,
    navigators: {
      ...state.navigators,
      [navigatorUID]: newState,
    },
  };
}
