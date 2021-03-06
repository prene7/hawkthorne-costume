module.exports = function( req, res ) {
	var request = require('request');

	// handles requests to parse the character .lua files from https://github.com/kyleconroy/hawkthorne-journey/
	// returns a json object

	var character = req.params.character;

	request(
		'https://raw.github.com/kyleconroy/hawkthorne-journey/master/src/characters/' + character + '.lua',

		function(error, response, body) {

			var resp = {};

			if( !error ) {

				if( response.statusCode == 200 ) {

					var _in = body.split("\n"),
						_out = [];

					var past_costumes_decl = false;

					while( _in.length ) {
						var l = _in.shift();

						// strip comments
						l = l.replace( /(.*)\s*--.*/, "$1" );

						// lines to remove
						if(!(
							   /^\s*$/.test(l)				// blank lines
							|| /= require/.test(l)		// requires
							|| /\.sheet/.test(l)
							|| /\(sheet\)/.test(l)		// anything to do with sheets
							|| /^\s*end\s*$/.test(l)	// end of function ( that was removed )
							|| /return /.test(l)		// not returning anything
							|| /beam:/.test(l)			// mmmm beams...
							|| /local new_plyr/.test(l) // remove redeclaration of plyr
							|| /position_matrix_main/.test(l) // remove redeclaration of plyr
						)) {

							// fix objects
							if(    /\{name.*sheet.*\}/.test(l)
							 	|| /^\s*[a-z]+\s=\s\{\s*$/i.test(l)
							)
								l = l.replace( /=/g ,':');

							// variables
							l = l.replace( /local /, 'var ' );

							// string concatenation
							l = l.replace( /\.\./g, '+' );

							// love specific code
							l = l.replace( /love\.graphics\.newImage\((.*)\)/, '$1' );
							l = l.replace( 'new_plyr', 'plyr' );

							// the meat
							if( /anim8\.newAnimation/.test(l) ) {

								l = l.replace( /anim8\.newAnimation\((.*)\)/, "[ $1 ]" );
								l = l.replace( /=/g , ':' );

								var middle = false;
								if( /g\(.*\)/.test(l) )
									middle = l.replace( /^.*g\(\s*(.*)\s*\).*$/, "$1" );
								if( /warp\(.*\)/.test(l) )
									middle = l.replace( /^.*warp\(\s*(.*)\s*\).*$/, '$1' );
								if( middle ) {
									// parse the params
									// fix the non quoted syntax
									if( /^\d*,\d*$/.test(middle) ) middle = '\'' + middle + '\'';
									// replace all single quotes
									middle = middle.replace( /'/g, '"' );
									var parsed = middle.splitCSV(),
										new_middle = [];
									for( var i in parsed ) {
										if( /^\d*,\d*$/.test( parsed[i] ) ) {
											_p = parsed[i].split(',');
											new_middle.push( [ _p[0] - 1, _p[1] - 1 ] );
										} else {
											var x_min, x_max, y_min, y_max, xy, x, y;
											xy = parsed[i].split(',');
											x = xy[0].split('-');
											y = xy[1].split('-');
											x_min = ( x[0] * 1 );
											x_max = ( x[ x.length - 1 ] * 1 );
											y_min = ( y[0] * 1 );
											y_max = ( y[ y.length - 1 ] * 1 );
											for( var _x = x_min; _x <= x_max; _x++ ) {
												for( var _y = y_min; _y <= y_max; _y++ ) {
													new_middle.push( [ _x - 1 , _y - 1 ] );
												}
											}
										}
									}
									l = l.replace( /g\((.*)\)/, JSON.stringify( new_middle ) );
									l = l.replace( /warp\((.*)\)/, JSON.stringify( new_middle ) );
								}

							}

							// costume object to array
							if( /plyr\.costumes = \{/.test(l) ) {
								past_costumes_decl = true;
								l = l.replace( /plyr\.costumes = \{/, 'plyr.costumes = [' );
							}
							if( /^\s*\}\s*$/.test(l) && past_costumes_decl == true ) {
								past_costumes_decl = false;
								l = l.replace( /^\s*\}\s*$/, ']' );
							}

							_out.push( l );
						}
					}

					//console.log( _out );

					try {
						eval( _out.join("\n") );
					} catch( e ) {
						resp.parseError = e+'';
					}

					if( plyr instanceof Object && !resp.parseError ) {
						resp.result = 'success';
						resp.data = plyr;
					} else {
						resp.result = 'parse error';
						resp.plyr = plyr;
					}

				} else {

					resp.result = 'unknown character';

				}

				resp.code = response.statusCode;

			} else {
				resp.result = 'invalid request';
			}

			res.json( resp );
		}
	);

};

function syntaxHighlight(json) {
	if (typeof json != 'string') {
		json = JSON.stringify(json, undefined, 2);
	}
	json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
		var cls = 'number';
		if (/^"/.test(match)) {
			if (/:$/.test(match)) {
				cls = 'key';
			} else {
				cls = 'string';
			}
		} else if (/true|false/.test(match)) {
			cls = 'boolean';
		} else if (/null/.test(match)) {
			cls = 'null';
		}
		return '<span class="' + cls + '">' + match + '</span>';
	});
}

String.prototype.splitCSV = function(sep) {
	for (var foo = this.split(sep = sep || ","), x = foo.length - 1, tl; x >= 0; x--) {
		if (foo[x].replace(/"\s+$/, '"').charAt(foo[x].length - 1) == '"') {
			if ((tl = foo[x].replace(/^\s+"/, '"')).length > 1 && tl.charAt(0) == '"') {
				foo[x] = foo[x].replace(/^\s*"|"\s*$/g, '').replace(/""/g, '"');
			} else if (x) {
				foo.splice(x - 1, 2, [foo[x - 1], foo[x]].join(sep));
			} else foo = foo.shift().split(sep).concat(foo);
		} else foo[x].replace(/""/g, '"');
	} return foo;
};