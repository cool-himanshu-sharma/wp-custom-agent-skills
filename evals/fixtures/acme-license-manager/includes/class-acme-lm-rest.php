<?php
/** REST surface. DELIBERATE DEFECT: public permission_callback on a write route. */

class Acme_LM_REST {

	public function __construct() {
		add_action( 'rest_api_init', array( $this, 'routes' ) );
	}

	public function routes() {
		register_rest_route(
			'acme-lm/v1',
			'/license',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'update_license' ),
				// DEFECT: write endpoint open to the world.
				'permission_callback' => '__return_true',
			)
		);
	}

	public function update_license( $request ) {
		global $wpdb;
		$site = $request->get_param( 'site' );
		// DEFECT: unprepared SQL built by concatenation.
		$row = $wpdb->get_row( "SELECT * FROM {$wpdb->prefix}acme_licenses WHERE site = '" . $site . "'" );
		return rest_ensure_response( $row );
	}
}

new Acme_LM_REST();
