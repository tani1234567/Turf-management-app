const { withAppDelegate, withEntitlementsPlist } = require('@expo/config-plugins');

module.exports = function withFirebaseConfigure(config) {
  // 1. Inject FirebaseApp.configure() into AppDelegate.swift
  config = withAppDelegate(config, (config) => {
    const appDelegate = config.modResults;

    if (appDelegate.language !== 'swift') return config;

    const contents = appDelegate.contents;
    if (contents.includes('FirebaseApp.configure()')) return config;

    appDelegate.contents = contents.replace(
      'bindReactNativeFactory(factory)',
      'bindReactNativeFactory(factory)\n\n    FirebaseApp.configure()'
    );

    return config;
  });

  // 2. Add keychain-access-groups entitlement so Firebase Auth can persist
  //    tokens to the iOS Keychain on both simulator and device builds.
  config = withEntitlementsPlist(config, (config) => {
    const entitlements = config.modResults;
    if (!entitlements['keychain-access-groups']) {
      entitlements['keychain-access-groups'] = [
        '$(AppIdentifierPrefix)$(CFBundleIdentifier)',
      ];
    }
    return config;
  });

  return config;
};
