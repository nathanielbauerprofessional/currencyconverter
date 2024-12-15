const i18n = require('i18n');
const path = require('path');

i18n.configure({
  locales: ['en', 'es', 'de'], 
  directory: path.join(__dirname, 'locales'), 
  defaultLocale: 'en',
  objectNotation: true, 
  cookie: 'locale', 
  logWarnFn: function (msg) {
    console.warn('WARN:', msg); 
  },
  logErrorFn: function (msg) {
    console.error('ERROR:', msg); 
  },
});

module.exports = i18n;