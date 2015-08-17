var dpoly = {
	m_playing : false,
	m_yield : 0,
	m_clear : false,
	m_buf : null,
	m_palette : new Array( 32 ),
	m_scale : 2,
	m_opcode : 255,
	m_primitives : new Array( ),
	m_savedPrimitives : new Array( ),

	init : function( canvas ) {
		this.m_canvas = document.getElementById( canvas );
//		this.m_cmd = window.atob( g_cmd );
		this.m_cmd = this.decode( window.atob( dat_cmd ) );
//		this.m_pol = window.atob( g_pol );
		this.m_pol = this.decode( window.atob( dat_pol ) );
	},

	start : function( ) {
		this.m_pos = 2;
		this.m_playing = true;
		this.setDefaultPalette( );
		this.m_timer = setInterval( function( ) { dpoly.doTick( ) }, 20 );
	},

	pause : function( ) {
		this.m_playing = !this.m_playing;
	},

	readByte : function( buf, pos ) {
		var value = buf.charCodeAt( pos );
		return value;
	},

	readWord : function( buf, pos ) {
		var value = buf.charCodeAt( pos ) * 256 + buf.charCodeAt( pos + 1 );
		return value;
	},

	readNextByte : function( ) {
		var value = this.readByte( this.m_cmd, this.m_pos );
		this.m_pos += 1;
		return value;
	},

	readNextWord : function( ) {
		var value = this.readWord( this.m_cmd, this.m_pos );
		this.m_pos += 2;
		return value;
	},

	toSignedByte : function( value ) {
		return value - ((value & 0x80) << 1);
	},

	toSignedWord : function( value ) {
		return value - ((value & 0x8000) << 1);
	},

	doTick : function( ) {
		if ( !this.m_playing ) {
			return;
		}
		if ( this.m_yield != 0 ) {
			this.m_yield -= 1;
			return;
		}
		while ( this.m_yield == 0 ) {
			var opcode = this.readNextByte( );
//			window.console.log('opcode=' + opcode + ' pos=' + this.m_pos);
			if (opcode & 0x80) {
				this.m_pos = 2;
				this.setDefaultPalette( );
				continue;
			}
			this.m_opcode = opcode >> 2;
			switch (this.m_opcode) {
			case 0:
			case 5:
			case 9:
				this.updateScreen( );
				break;
			case 1:
				this.m_clear = this.readNextByte( );
				this.clearScreen( );
				break;
			case 2:
				this.m_yield = this.readNextByte( ) * 4;
				break;
			case 3:
				var shape = this.readNextWord( );
				var x = 0;
				var y = 0;
				if (shape & 0x8000) {
					shape = shape & 0x7FFF;
					x = this.toSignedWord( this.readNextWord( ) );
					y = this.toSignedWord( this.readNextWord( ) );
				}
				this.drawShape( shape, x, y );
				break;
			case 4:
				var src = this.readNextByte( );
				var dst = this.readNextByte( );
				this.setPalette( src, dst );
				break;
			case 10:
				var shape = this.readNextWord( );
				var x = 0;
				var y = 0;
				if (shape & 0x8000) {
					shape = shape & 0x7FFF;
					x = this.toSignedWord( this.readNextWord( ) );
					y = this.toSignedWord( this.readNextWord( ) );
				}
				var z = 512 + this.readNextWord( );
				var ix = this.readNextByte( );
				var iy = this.readNextByte( );
				this.drawShapeScale( shape, x, y, z, ix, iy );
				break;
			case 11:
				var shape = this.readNextWord( );
				var x = 0;
				var y = 0;
				if (shape & 0x8000) {
					shape = shape & 0x7FFF;
					x = this.toSignedWord( this.readNextWord( ) );
					y = this.toSignedWord( this.readNextWord( ) );
				}
				var z = 512;
				if (shape & 0x4000) {
					shape = shape & 0x3FFF;
					z += this.readNextWord( );
				}
				var ix = this.readNextByte( );
				var iy = this.readNextByte( );
				var r1 = this.readNextWord( );
				var r2 = 90;
				if (shape & 0x2000) {
					shape = shape & 0x1FFF;
					r2 = this.readNextWord( );
				}
				var r3 = 180;
				if (shape & 0x1000) {
					shape = shape & 0xFFF;
					r3 = this.readNextWord( );
				}
				this.drawShapeScaleRotate( shape, x, y, z, ix, iy, r1, r2, r3 );
				break;
			case 12:
				this.m_yield = 10;
				break;
			default:
				this.m_playing = false;
				break;
			}
		}
	},

	updateScreen : function( ) {
		var context = this.m_canvas.getContext( '2d' );
		context.fillStyle = '#000';
		context.fillRect( 0, 0, this.m_canvas.width, this.m_canvas.height );
		for (var i = 0; i < this.m_primitives.length; i++) {
			var primitive = this.m_primitives[i];
			this.drawPrimitive( primitive.x, primitive.y, primitive.num, primitive.color, false );
		}
		this.flipScreen();
		this.m_yield = 5;
	},

	clearScreen : function( ) {
		if (this.m_clear != 0) {
			this.flipScreen( );
		}
	},

	drawShape : function( num, x, y ) {
		var offset = this.readWord( this.m_pol, 2 );
		var shapeOffset = this.readWord( this.m_pol, offset + num * 2 );

		offset = this.readWord( this.m_pol, 14 );
		offset += shapeOffset;

		var count = this.readWord( this.m_pol, offset );
		offset += 2;

		var dx, dy;
		for (var i = 0; i < count; ++i) {
			var verticesOffset = this.readWord( this.m_pol, offset );
			offset += 2;
			if (verticesOffset & 0x8000) {
				dx = this.toSignedWord( this.readWord( this.m_pol, offset ) );
				offset += 2;
				dy = this.toSignedWord( this.readWord( this.m_pol, offset ) );
				offset += 2;
			} else {
				dx = 0;
				dy = 0;
			}
			var alpha = (verticesOffset & 0x4000) != 0;
			var color = this.readByte( this.m_pol, offset );
			offset++;

			if (this.m_clear == 0) {
				color += 16;
			}

			this.queuePrimitive( x + dx, y + dy, verticesOffset & 0x3FFF, color, alpha );
		}
		if (this.m_clear != 0) {
			this.savePrimitives( );
		}
	},

	drawShapeScale : function( num, x, y, z, ix, iy ) {
		// TODO:
	},

	drawShapeScaleRotate : function( num, x, y, z, ix, iy, r1, r2, r3 ) {
		// TODO:
	},

	setDefaultPalette : function( ) {
		for ( var i = 0; i < 16; i++ ) {
			var color = '#' + i.toString( 16 ) + i.toString( 16 ) + i.toString( 16 );
			this.m_palette[ 16 + i ] = this.m_palette[ i ] = color;
		}
	},

	setPalette : function( src, dst ) {
		var offset = this.readWord( this.m_pol, 6 );
		offset += src * 32;

		var palOffset = 0;
		if ( dst == 0 ) {
			palOffset = 16;
		}

		for ( var i = 0; i < 16; i++ ) {
			var color = this.readWord( this.m_pol, offset );
			offset += 2;

			var r = (color >> 8) & 15;
			var g = (color >> 4) & 15;
			var b = color & 15;
			this.m_palette[ palOffset ] = '#' + r.toString( 16 ) + g.toString( 16 ) + b.toString( 16 );
			++palOffset;
		}
	},

	flipScreen : function( ) {
		if ( this.m_clear != 0 ) {
			this.clearPrimitives( );
		} else {
			this.restorePrimitives( );
		}
	},

	queuePrimitive : function( x, y, num, color, alpha ) {
		var primitive = { x : x, y : y, num : num, color : color };
		this.m_primitives.push( primitive );
	},

	clearPrimitives : function( ) {
		this.m_primitives = [ ];
	},

	restorePrimitives : function( ) {
		this.m_primitives = this.m_savedPrimitives.slice();
	},

	savePrimitives : function( ) {
		this.m_savedPrimitives = this.m_primitives.slice();
	},

	drawPrimitive : function( x, y, num, color, alpha ) {
		var offset = this.readWord( this.m_pol, 10 );
		var verticesOffset = this.readWord( this.m_pol, offset + num * 2 );

		offset = this.readWord( this.m_pol, 18 );
		offset += verticesOffset;

		var count = this.readByte( this.m_pol, offset );
		offset++;

		x += this.toSignedWord( this.readWord( this.m_pol, offset ) );
		offset += 2;
		y += this.toSignedWord( this.readWord( this.m_pol, offset ) );
		offset += 2;

		var scale = this.m_scale;

		var context = this.m_canvas.getContext( '2d' );
		context.fillStyle = context.strokeStyle = this.m_palette[ color ];
		context.save( );
		context.scale( scale, scale );
		if (count & 0x80) {
			context.translate( x, y );
			var rx = this.toSignedWord( this.readWord( this.m_pol, offset ) );
			offset += 2;
			var ry = this.toSignedWord( this.readWord( this.m_pol, offset ) );
			offset += 2;
			context.scale( rx, ry / rx );
			context.beginPath( );
			context.arc( 0, 0, rx, 0, 2 * Math.PI, false );
			context.closePath( );
			context.fill( );
		} else if (count == 0) {
			context.fillRect( x, y, scale, scale );
		} else {
			context.beginPath( );
			context.moveTo( x, y );
			for ( var i = 0; i < count; ++i ) {
				var dx = this.toSignedByte( this.readByte( this.m_pol, offset ) );
				offset++;
				var dy = this.toSignedByte( this.readByte( this.m_pol, offset ) );
				offset++;
				x += dx;
				y += dy;
				context.lineTo( x, y );
			}
			context.closePath( );
			if (count <= 2) {
				context.stroke( );
			} else {
				context.fill( );
			}
		}
		context.restore( );
	},

	decode : function( data ) {
		var out = '';
		var i = 0;
		while (i < data.length) {
			var mask = data.charCodeAt( i );
			++i;
			for (var bit = 0; bit < 8 && i < data.length; ++bit) {
				if ((mask & (1 << bit)) == 0) {
					out += data.charAt( i );
					++i;
				} else {
					var offset = data.charCodeAt( i ) * 256 + data.charCodeAt( i + 1 );
					i += 2;
					var len = (offset >> 12) + 3;
					offset &= 4095;
					for (var j = 0; j < len; ++j) {
						var chr = out[out.length - offset];
						out += chr;
					}
				}
			}
		}
		return out;
	}
}
