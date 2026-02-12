import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';

import * as Convenience from '../convenience.js';

import * as util from '../util.js';
import { ModeUtils as modeUtils } from './modeUtils.js';

var onlyCurrentWorkspaceToggled = false;

export function setOnlyCurrentWorkspaceToggled(v) {
  onlyCurrentWorkspaceToggled = v;
}

export var Switcher = (function () {
  // Limit the number of displayed items
  const MAX_NUM_ITEMS = 15;

  let replacementsMap = new Map();

  let updateReplacements = function () {
    replacementsMap.clear();
    let replacements = Convenience.getSettings().get_strv('window-replacements');
    if (replacements && replacements.length > 0) {
      for (let i = 0; i < replacements.length; i++) {
        let parts = replacements[i].split(',');
        if (parts.length >= 3) {
          let p1 = parts[0].trim().replace(/^['"]|['"]$/g, '');
          let p2 = parts[1].trim().replace(/^['"]|['"]$/g, '');
          let p3 = parts.slice(2).join(',').trim().replace(/^['"]|['"]$/g, '');

          if (!replacementsMap.has(p1)) {
            let regex = null;
            try {
              if (!p3.startsWith('^')) p3 = '^' + p3;
              if (!p3.endsWith('$')) p3 = p3 + '$';
              regex = new RegExp(p3);
            } catch (e) {
              print('Invalid regex in switcher replacement: ' + p3);
            }
            replacementsMap.set(p1, {
              appName: p2.replace(/&/g, '&amp;'),
              regex: regex
            });
          }
        }
      }
    }
  };

  let name = function () {
    return 'Switcher';
  };

  let filter = function (app) {
    let onlyCurrentWorkspace = Convenience.getSettings().get_boolean(
      'only-current-workspace'
    );
    let currentWorkspace = util.getCurrentWorkspace();
    const workspace = app.get_workspace();
    const workspaceIndex = workspace ? workspace.index() : null;
    return (
      (!onlyCurrentWorkspace && !onlyCurrentWorkspaceToggled) ||
      (onlyCurrentWorkspace && onlyCurrentWorkspaceToggled) ||
      workspaceIndex === currentWorkspace
    );
  };

  let activate = function (app) {
    Main.activateWindow(app);
  };

  let apps = function () {
    updateReplacements();
    // Get all windows in activation order
    let tabList = global.display.get_tab_list(Meta.TabList.NORMAL, null);
    if (tabList.length > 0) {
      tabList.shift();
    }
    return tabList.map(tab => ({ app: tab, mode: Switcher, activate }));
  };


  let description = function (app) {
    const appRef = Shell.WindowTracker.get_default().get_window_app(app);
    let appName;
    let rawAppName;
    try {
      rawAppName = appRef.get_name();
      appName = rawAppName.replace(/&/g, '&amp;');
    } catch (e) {
      print(e);
      appName = 'Could not get name';
      rawAppName = '';
    }

    let windowTitle = app.get_title();

    if (replacementsMap.has(rawAppName)) {
      let replacement = replacementsMap.get(rawAppName);
      appName = replacement.appName;
      if (replacement.regex) {
        const match = windowTitle.match(replacement.regex);
        if (match && match.length > 1) {
          windowTitle = match[1].trim();
        }
      }
    }

    const extras = modeUtils.getExtras(appRef)
    if (appName == windowTitle && extras.length === 0) {
      return appName
    }

    return `${appName}  →  ${windowTitle} ${extras}`;
  };

  let makeBox = function (appObj, index, onActivate, oldBox) {
    const app = appObj.app;
    const appRef = Shell.WindowTracker.get_default().get_window_app(app);
    if (!appRef) return null;
    return modeUtils.makeBox(
      appObj,
      app,
      appRef,
      description(app),
      index,
      onActivate,
      oldBox
    );
  };

  return {
    MAX_NUM_ITEMS,
    name,
    apps,
    filter,
    activate,
    description,
    makeBox,
    cleanIDs: modeUtils.cleanIDs
  };
})();
