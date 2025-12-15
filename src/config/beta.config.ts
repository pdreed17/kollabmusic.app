/**
 * Beta Testing Configuration
 *
 * Adjust these values to control beta testing features
 */

export const BetaConfig = {
  /**
   * Number of users who automatically get Pro access during beta testing.
   * Set to 0 to disable automatic Pro access.
   *
   * To change this number:
   * 1. Update the value below
   * 2. Rebuild the app
   *
   * Note: This counts all users in the database, so changing this number
   * after launch will only affect NEW users created after the change.
   */
  AUTO_PRO_USER_LIMIT: 50,

  /**
   * Whether beta mode is enabled
   * Set to false to disable all beta features
   */
  BETA_MODE_ENABLED: true,
} as const;
