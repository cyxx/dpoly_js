var player = {
	m_startPos : 0,
	m_pos : 0,
	m_playing : false,
	m_yield : 0,
	m_clear : false,
	m_buf : null,
	m_palette : new Array( 32 ),
	m_scale : 2,
	m_opcode : 255,
	m_primitives : new Array( ),
	m_savedPrimitives : new Array( ),
	m_fixUpPalette : 0,

	init : function( canvas ) {
		this.m_canvas = document.getElementById( canvas );
		this.m_timer = setInterval( function( ) { player.doTick( ) }, 15 );
	},

	start : function( pos ) {
		this.m_pos = this.m_startPos = this.readOffset( pos );
		this.m_playing = true;
		this.setDefaultPalette( );
	},

	pause : function( ) {
		this.m_playing = !this.m_playing;
	},

	readOffset : function( pos ) {
		if ( pos != 0 ) {
			pos = this.readWord( this.m_cmd, ( pos + 1 ) * 2 );
		}
		var offset = ( this.readWord( this.m_cmd, 0 ) + 1 ) * 2;
		return offset + pos;
	},

	readByte : function( buf, pos ) {
		var value = buf[ pos ];
		return value;
	},

	readWord : function( buf, pos ) {
		var value = buf[ pos ] * 256 + buf[ pos + 1 ];
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
//			console.log('opcode=' + opcode + ' pos=' + this.m_pos);
			if (opcode & 0x80) {
				this.m_playing = false;
				break;
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
			case 6:
				var id = this.readNextWord( );
				break;
			case 7:
				break;
			case 8:
				this.m_pos += 3;
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
				var z = 512 + this.toSignedWord( this.readNextWord( ) );
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
					z += this.toSignedWord( this.readNextWord( ) );
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
			case 13:
				var id = this.readNextWord( );
				if (id != 0xFFFF) {
					var x = this.readNextByte( );
					var y = this.readNextByte( );
				}
				break;
			default:
				console.log( "Invalid opcode=" + opcode );
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
			var p = this.m_primitives[i];
			this.drawPrimitive( p.x, p.y, p.dx, p.dy, p.num, p.color, false, p.transform );
		}
		this.flipScreen();
		this.m_yield = 5;
	},

	clearScreen : function( ) {
		if (this.m_clear != 0) {
			this.flipScreen( );
		}
	},

	drawShape : function( num, x, y, t ) {
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

			this.queuePrimitive( x, y, dx, dy, verticesOffset & 0x3FFF, color, alpha, t );
		}
		if (this.m_clear != 0) {
			this.savePrimitives( );
		}
	},

	drawShapeScale : function( num, x, y, z, ix, iy ) {
		this.drawShape( num, x, y, { z : z, ix : ix, iy : iy } );
	},

	drawShapeScaleRotate : function( num, x, y, z, ix, iy, r1, r2, r3 ) {
		this.drawShape( num, x, y, { z : z, ix : ix, iy : iy, r1 : r1, r2 : r2, r3 : r3 } );
	},

	setDefaultPalette : function( ) {
		for ( var i = 0; i < 16; i++ ) {
			var color = '#' + i.toString( 16 ) + i.toString( 16 ) + i.toString( 16 );
			this.m_palette[ 16 + i ] = this.m_palette[ i ] = color;
		}
		this.m_fixUpPalette = 0;
	},

	setTaxiPalette : function( ) {
		// colors from PC DOS version
		var colors = [ '000', 'fff', '000', '886', '664', '444', 'aa8', '684', 'ec0', 'ea0', 'c60', 'a40', '620', '66c', '44a', 'e86' ];
		for ( var i = 0; i < 16; ++i ) {
			this.m_palette[ 16 + i ] = '#' + colors[ i ];
		}
		this.m_fixUpPalette = 1;
	},

	setPalette : function( src, dst ) {
		var offset = this.readWord( this.m_pol, 6 );
		offset += src * 32;

		var palOffset = 0;
		if ( dst == 0 ) {
			if ( this.m_fixUpPalette != 0 ) {
				return;
			}
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

	queuePrimitive : function( x, y, dx, dy, num, color, alpha, t ) {
		var primitive = { x : x, y : y, dx : dx, dy : dy, num : num, color : color, transform : t };
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

	drawPrimitive : function( x, y, dx, dy, num, color, alpha, t ) {
		var offset = this.readWord( this.m_pol, 10 );
		var verticesOffset = this.readWord( this.m_pol, offset + num * 2 );

		offset = this.readWord( this.m_pol, 18 );
		offset += verticesOffset;

		var count = this.readByte( this.m_pol, offset );
		offset++;

		var pixelSize = this.m_scale;

		var context = this.m_canvas.getContext( '2d' );
		context.fillStyle = context.strokeStyle = this.m_palette[ color ];
		context.save( );
		context.scale( pixelSize, pixelSize );

		var xpos = this.toSignedWord( this.readWord( this.m_pol, offset ) );
		offset += 2;
		var ypos = this.toSignedWord( this.readWord( this.m_pol, offset ) );
		offset += 2;

		if ( t ) {
			context.translate( t.ix, t.iy );
			context.scale( t.z / 512, t.z / 512 );
			xpos -= t.ix;
			ypos -= t.iy;
			// TODO: r1, r2, r3
		}
		x += xpos + dx;
		y += ypos + dy;

		if (count & 0x80) {
			context.translate( x, y );
			var rx = this.toSignedWord( this.readWord( this.m_pol, offset ) );
			offset += 2;
			var ry = this.toSignedWord( this.readWord( this.m_pol, offset ) );
			offset += 2;
			context.scale( rx, ry );
			context.beginPath( );
			context.arc( 0, 0, 1, 0, 2 * Math.PI, false );
			context.closePath( );
			context.fill( );
		} else if (count == 0) {
			context.fillRect( x, y, pixelSize, pixelSize );
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
			if (count < 2) {
				context.stroke( );
			} else {
				context.fill( );
			}
		}
		context.restore( );
	},

	readUint16BE : function( data, offset ) {
		var value = data.charCodeAt( offset ) * 256;
		value += data.charCodeAt( offset + 1 );
		return value;
	},

	readUint32BE : function( data, offset ) {
		var value = this.readUint16BE( data, offset ) << 16;
		value |= this.readUint16BE( data, offset + 2 );
		return value;
	},

	decode : function( data ) {
		var offset = 0;
		var packedSize = this.readUint32BE( data, offset ); offset += 4;
		console.log("POL size=" + packedSize );
		if ( packedSize & (1 << 31) ) {
			packedSize = 0x100000000 - packedSize;
			this.m_pol = data.slice( offset, offset + packedSize );
		} else {
			var size = this.readUint32BE( data, offset + packedSize - 4 );
			var dat_pol = data.slice( offset, offset + packedSize );
			var ret = decoder.decode( dat_pol );
			this.m_pol = decoder.m_out;
		}
		offset += packedSize;
		packedSize = this.readUint32BE( data, offset ); offset += 4;
		console.log("CMD size=" + packedSize);
		if ( packedSize & (1 << 31) ) {
			packedSize = 0x100000000 - packedSize;
			this.m_cmd = data.slice( offset, offset + packedSize );
		} else {
			var size = this.readUint32BE( data, offset + packedSize - 4 );
			var dat_cmd = data.slice( offset, offset + packedSize );
			var ret = decoder.decode( dat_cmd );
			this.m_cmd = decoder.m_out;
		}
	}
}
