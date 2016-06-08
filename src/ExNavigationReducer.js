/**
 * @providesModule ExNavigationReducer
 */

import _ from 'lodash';

import {
  NavigationExperimental,
} from 'react-native';

import invariant from 'invariant';

import ActionTypes from 'ExNavigationActionTypes';

const {
  StateUtils: NavigationStateUtils,
} = NavigationExperimental;

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

  static [ActionTypes.SET_CURRENT_NAVIGATOR](state, { navigatorUID, parentNavigatorUID, navigatorType, defaultRouteConfig, children, index }) {
    if (!state.navigators[navigatorUID] && !children) {
      return state;
    }

    let newState = {
      currentNavigatorUID: navigatorUID,
    };

    if (children) {
      const navigatorState = state.navigators[navigatorUID];
      children = children.map(child => {
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
            ...NavigationStateUtils.set(navigatorState, navigatorUID, children, index),
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
      children: [],
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

  static [ActionTypes.IMMEDIATELY_RESET_STACK](state, { navigatorUID, children, index }) {
    const navigatorState = state.navigators[navigatorUID] || {
      children: [],
      index: 0,
      key: navigatorUID,
      defaultRouteConfig: {},
      type: 'stack',
    };

    const defaultRouteConfig = navigatorState.defaultRouteConfig;

    const newChildren = children.map(child => {
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

  static [ActionTypes.JUMP_TO_TAB](state, { navigatorUID, tab }) {
    invariant(state.navigators[navigatorUID], 'Navigator does not exist.');
    invariant(state.navigators[navigatorUID].type === 'tab', 'Navigator is not tab navigator.');

    const newNavigatorState = { ...state.navigators[navigatorUID] };
    const selectedTab = newNavigatorState.children[newNavigatorState.index];

    if (tab.key === selectedTab.key) { // haven't changed tabs
      return state;
    }

    let tabIndex = NavigationStateUtils.indexOf(newNavigatorState, tab.key);
    if (tabIndex !== null) {
      const oldTab = newNavigatorState.children[tabIndex];
      newNavigatorState.children.splice(tabIndex, 1);
      newNavigatorState.children.push(oldTab);
    } else {
      newNavigatorState.children.push(tab);
    }

    newNavigatorState.index = newNavigatorState.children.length - 1;

    return {
      ..._updateNavigator(state, navigatorUID, newNavigatorState),
      currentNavigatorUID: navigatorUID,
    };
  }
}

export default ExNavigationReducer.reduce;

function _updateNavigator(state, navigatorUID, newState) {
  return {
    ...state,
    navigators: {
      ...state.navigators,
      [navigatorUID]: newState,
    },
  };
}
