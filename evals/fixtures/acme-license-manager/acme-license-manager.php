<?php
/**
 * Plugin Name: Acme License Manager
 * Plugin URI:  https://example.com/acme-license-manager
 * Description: Fixture plugin for wp-custom-agent-skills evals. Contains deliberate defects.
 * Version:     1.4.2
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Author:      Acme
 * Text Domain: acme-license-manager
 * Domain Path: /languages
 * License:     GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'ACME_LM_VERSION', '1.4.2' );
define( 'ACME_LM_FILE', __FILE__ );
define( 'ACME_LM_DIR', plugin_dir_path( __FILE__ ) );

require_once ACME_LM_DIR . 'includes/class-acme-lm-admin.php';
require_once ACME_LM_DIR . 'includes/class-acme-lm-rest.php';

register_activation_hook( __FILE__, 'acme_lm_activate' );

function acme_lm_activate() {
	add_option( 'acme_lm_settings', array(), '', true );
	update_option( 'acme_lm_db_version', ACME_LM_VERSION );
	wp_schedule_event( time(), 'daily', 'acme_lm_check_license' );
}

function acme_lm_get_expiry() {
	return get_option( 'acme_lm_license_expiry' );
}

add_action( 'acme_lm_check_license', 'acme_lm_remote_check' );

function acme_lm_remote_check() {
	$key = get_option( 'acme_lm_license_key' );
	$res = wp_remote_get( 'https://api.example.com/v1/check?key=' . $key );
	set_transient( 'acme_lm_license_status', wp_remote_retrieve_body( $res ), DAY_IN_SECONDS );
}

do_action( 'acme_lm_loaded' );
