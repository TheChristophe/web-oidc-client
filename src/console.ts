const PREFIX = '%c[AuthClient]';
const STYLE = 'font-variant:small-caps;font-color:orange';

export const logDebug = (...args: Parameters<typeof console.debug>) => {
  console.debug(PREFIX, STYLE, ...args);
};

export const logInfo = (...args: Parameters<typeof console.info>) => {
  console.info(PREFIX, STYLE, ...args);
};

export const logWarn = (...args: Parameters<typeof console.warn>) => {
  console.warn(PREFIX, STYLE, ...args);
};

export const logError = (...args: Parameters<typeof console.error>) => {
  console.error(PREFIX, STYLE, ...args);
};

export const logObject = (...args: Parameters<typeof console.dir>) => {
  console.dir(...args);
};
