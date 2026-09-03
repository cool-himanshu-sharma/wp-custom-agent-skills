<?php
/** Admin surface. DELIBERATE DEFECTS: missing cap check + unescaped output. */

class Acme_LM_Admin {

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'menu' ) );
		add_action( 'wp_ajax_acme_lm_save_key', array( $this, 'save_key' ) );
		add_action( 'admin_notices', array( $this, 'expiry_notice' ) );
	}

	public function menu() {
		add_menu_page(
			__( 'Acme License', 'acme-license-manager' ),
			__( 'Acme License', 'acme-license-manager' ),
			'manage_options',
			'acme-license',
			array( $this, 'render' )
		);
	}

	public function render() {
		$key = get_option( 'acme_lm_license_key' );
		echo '<div class="wrap"><h1>' . esc_html__( 'Acme License', 'acme-license-manager' ) . '</h1>';
		// DEFECT: unescaped option value echoed into HTML.
		echo '<input type="text" value="' . $key . '" />';
		echo '</div>';
	}

	// DEFECT: nonce checked but NO capability check -> any logged-in subscriber can write.
	public function save_key() {
		check_ajax_referer( 'acme_lm_nonce' );
		update_option( 'acme_lm_license_key', sanitize_text_field( wp_unslash( $_POST['key'] ) ) );
		wp_send_json_success();
	}

	public function expiry_notice() {
		$expiry = acme_lm_get_expiry();
		if ( ! $expiry ) {
			return;
		}
		echo '<div class="notice notice-warning"><p>' . esc_html( $expiry ) . '</p></div>';
	}
}

new Acme_LM_Admin();
