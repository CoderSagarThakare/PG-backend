// Mongoose plugins index

/**
 *
 * This modularity enables developers to add new features or modify existing ones without directly modifying the main code,
 * making it easier to maintain and update the application.
 *
 * Plug-ins allow users or developers to customize the application's behavior
 * without needing access to or deep knowledge of its internal workings.
 *
 */

module.exports = {
  private: require("./private.plugin"),
};