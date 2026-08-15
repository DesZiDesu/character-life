/* Emergency compatibility shim for Character Life v1.7.2.
 * The previous presentation-pack startup observer could retrigger itself and lock the SillyTavern UI.
 * Keep this file safe for hosted installs that still reference the old entry point.
 */
import './theme-studio-v171.js';
