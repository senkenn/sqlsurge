gen-wasm-for-extension:
	rm -rf ./vsce/sql-extraction-rs
	cd sql-extraction/rs && wasm-pack build --target bundler --out-dir ../../vsce/sql-extraction-rs --release
