const { withAppDelegate } = require('@expo/config-plugins');

module.exports = function withFirebaseConfigure(config) {
  return withAppDelegate(config, (config) => {
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
};
