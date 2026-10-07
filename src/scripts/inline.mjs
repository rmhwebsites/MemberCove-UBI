/**
 * The one inline script on every page. It runs before the first paint so content that animates in
 * starts hidden instead of flashing. If the main script has not started within 2.5 seconds (it
 * failed to load, say), the class comes off again and everything shows without animation.
 * astro.config.mjs hashes this exact text into the content security policy, so edit it only here.
 */
export const JS_MARKER =
  'document.documentElement.classList.add("js");setTimeout(function(){if(!document.documentElement.classList.contains("js-ready"))document.documentElement.classList.remove("js")},2500);';
