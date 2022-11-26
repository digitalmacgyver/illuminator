"use strict";

// Next up: 
//
// 1) Show noun presence box by scene.
//   - Horizontal scale by line number
//   - Filtered by standard rules
//   - Mouse over brings up text
//   - Maybe different colors or icons for types?
// - Draw an arbitrary scene.
// - Make the scene actually select it.
//
//
//8) Upload PDF
//
//9) Parse FDX
//
//10) Upload FDX
//
// Examples of mouse over stuff: http://bl.ocks.org/Guerino1/2164562,http://bl.ocks.org/Guerino1/2141479

String.prototype.titleCase = function () {
    return this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
};

// Import the actual script metadata.
var presence_sn = {};
var scenes = {};
var script = [];
var noun_types = {};
var interaction_sn = {};

var completed = 0;

var home = '/script_data/{{ script_id }}/';

function load_all_data() {
    d3.json( home + 'script/', function ( e, d ) {
	script = d;
	completed++;
	if ( completed == 5 ) {
	illuminate();
	}
    } );
    d3.json( home + 'scenes/', function ( e, d ) {
	scenes = d;
	completed++;
	if ( completed == 5 ) {
	    illuminate();
	}
    } );
    d3.json( home + 'noun_types/', function ( e, d ) {
	noun_types = d;
	completed++;
	if ( completed == 5 ) {
	    illuminate();
	}
    } );
    d3.json( home + 'presence_sn/', function ( e, d ) {
	presence_sn = d;
	completed++;
	if ( completed == 5 ) {
	    illuminate();
	}
    } );
    d3.json( home + 'interaction_sn/', function ( e, d ) {
	interaction_sn = d;
	completed++;
	if ( completed == 5 ) {
	    illuminate();
	}
    } );
}

load_all_data();

function illuminate() {
    var selection = {
	'noun_types': {
	    'CHARACTER' : true,
	    'LOCATION'  : true,
	    'THING'     : true
	},
	'presence_types': {
	    'APPEAR'  : true,
	    'DISCUSS' : true,
	    'MENTION' : true,
	    'SETTING' : true
	},
	'interaction_types': {
	    'APPEAR'  : true,
	    'DISCUSS' : true,
	    'MENTION' : true,
	    'SETTING' : true
	},
	'top_n' : 8,
	'current_scene': false,
	'current_noun' : false
    };

    ///////////////////////////////////////////////////////
    // Global configuration
    ///////////////////////////////////////////////////////
    // Durations for transitions.
    var duration = 2000;

    // Control panel stuff
    var control_width = 250;
    $( '#control_panel' ).width( control_width );

    // A scale of colors for our nouns.
    var color = d3.scale.category10();

    ///////////////////////////////////////////////////////
    // Configuration for script_viz and relation_viz
    ///////////////////////////////////////////////////////

    // Height of our rows and padding between scenes.
    var box_height = 30;
    var x_padding = 2;
    var y_padding = 2;

    var margin = { top: 0, right: 30, bottom: 30, left: 160 };
    var sv_width  = $( window ).width() - control_width - 60;
    var sv_height = ( selection.top_n + 1 )*( box_height + y_padding );
    
    // Populate the initial values of our global data structures with
    // some stub information.
    var total_lines = 100;
    var max_presence_density = 10/33;
    var scene_lines = [20, 50, 30];
    var scene_first = [0, 20, 70];
    var presence = [
	{ name: 'Joker', type: 'Character', presence: [4, 12, 8] },
	{ name: 'Batman', type: 'Character', presence: [6, 10, 10] }
    ];
    var max_relation_density = undefined;
    var relation_to = [];

    ///////////////////////////////////////////////////////
    // Configuration for graph.
    ///////////////////////////////////////////////////////
    var g_width = 250;
    var g_height = 250;
    $( '#graph_div' ).width( g_width );

    var max_node_interactions = 0;
    var max_link_interactions = 0;

    var g_charge = -120;
    var g_link_distance = 80;

    var g_force = undefined;

    ///////////////////////////////////////////////////////
    // Configuration for Noun Scene Presence Details
    ///////////////////////////////////////////////////////
    var nspd_width = 500;
    var nspd_height = 300;

    // The contents of presence_sn[current_scene][current_noun]
    // filtered by whatever our selections are.  Set in
    // refresh_presence_display_data.
    var nsp_details = [];
    
    ///////////////////////////////////////////////////////
    // Prepare global data structures.
    ///////////////////////////////////////////////////////

    // Compute the relevant data based upon our present selections.
    refresh_presence_display_data( presence_sn, scenes, script ); 
    
    ///////////////////////////////////////////////////////
    // Render our page
    ///////////////////////////////////////////////////////
    
    // Draw script_viz
    draw_script_viz();
    draw_relation_viz();
    draw_scene_graph();
    draw_noun_scene_presence_details();

    // Register events for form data.
    $( "#top_n" ).on( 'change', update_top_n );
    $( "#noun_types" ).on( 'change', update_noun_types );
    $( "#presence_types" ).on( 'change', update_presence_types );
    $( "#interaction_types" ).on( 'change', update_interaction_types );
    $( "#control_form" ).on( 'submit', function ( e ) { e.preventDefault(); } )
    $( "#script_select" ).on( 'change', function ( e ) { e.preventDefault(); } )
    $( window ).resize( function () {
	sv_width = $( window ).width() - control_width - 60;
	update_script_viz();
	update_relation_viz();
    } );
    
    ///////////////////////////////////////////////////////
    // script_viz helpers.
    ///////////////////////////////////////////////////////

    function draw_script_viz() {
	create_script_viz();
	update_script_viz();
    }

    function create_script_viz() {
	var svg = d3.select( '#script_div' )
	    .append( 'svg' )
	    .attr( 'id', 'script_viz' )
	    .attr( 'width', sv_width )
	    .attr( 'height', sv_height )
	    .append( 'g' )
	    .attr( 'transform', 'translate(' + margin.left + ',' + margin.top + ')' );
    }
    
    function update_script_viz() {
	d3.select( '#script_viz' )
	    .transition().duration( duration )
	    .attr( 'width', sv_width )
	    .attr( 'height', sv_height );
	
	var svg = d3.select( '#script_viz g' );

	var x = d3.scale.linear()
	    .domain( [0, total_lines+scene_lines.length*x_padding] )
	    .range( [0, sv_width - margin.left - margin.right] );

	var row = svg.selectAll( '.row' )
	    .data( presence, function ( d ) { return d.name; } );

	row.enter()
	    .append( 'g' )
	    .attr( 'class', 'row' )
	    .append( 'text' )
	    .attr( 'x', -6 )
	    .attr( 'y', box_height/2 )
	    .attr( 'dy', '.32em' )
	    .attr( 'text-anchor', 'end' )
	    .text( function ( d ) { return d.name.titleCase(); } )
	    .style( 'font', '10px sans-serif' );

	row.transition().duration( duration )
	    .attr( 'fill', function ( d, i ) { 
		return color(d.name);
	    } )
	    .attr( 'transform',  
		   function( d, i ) { 
		       return 'translate( 0, ' + ( box_height+y_padding )*( i+1 ) + ')'; 
		   } 
		 )
	    .each( row_update );

	row.exit()
	    .transition().duration( duration )
	    .style( 'fill-opacity', 0)
	    .attr( 'transform', function ( d, i ) {
		return 'translate( 0,' + sv_height + ')';
	    } )
	    .remove();

	var column = svg.selectAll( '.column' )
	    .data( scene_first, function ( d ) { return d+1; } );

	column.enter()
	    .append( 'g' )
	    .append( 'text' )
	    .attr( 'x', function ( d, i ) { return x(scene_lines[i]) / 2; } )
	    .attr( 'y', box_height / 2 )
	    .attr( 'text_anchor', 'middle' )
	    .attr( 'font-size', '.5em' )
	    .text( function ( d, i ) { return i+1; } )
	    .attr( 'id', function ( d, i ) { return 'sv_col'+i; } )
	    .attr( 'class', 'subtle' )
	    .on( 'mouseover', function ( d, i ) { 
		d3.select( '#sv_col' + i ).attr( 'class', 'highlighted' ); 
		d3.select( '#rel_col' + i ).attr( 'class', 'highlighted' ); 
	    } )
	    .on( 'mouseout', function ( d, i ) { 
		d3.select( '#sv_col' + i ).attr( 'class', 'subtle' ); 
		d3.select( '#rel_col' + i ).attr( 'class', 'subtle' ); 
	    } )
	    .on( 'click', function( d, i ) {
		selection.current_scene = i+1; 
		update_scene_graph(); 
		update_noun_scene_presence_details();
	    } );

	column.attr( 'class', 'column' )
	    .attr( 'transform', function ( d, i ) { return 'translate(' + x(d+i*x_padding) + ', 0)'; } );

	function row_update( row ) {
	    var cell = d3.select( this )
		.selectAll( '.cell' )
		.data( row.presence );

	    cell.enter()
		.append( 'rect' )
		.style( 'fill-opacity', 0 )
		.on( 'click', 
		     function ( d, i ) { 
			 selection.current_noun = row.name; 
			 selection.current_scene = i+1; 
			 update_scene_graph(); 
			 refresh_relation_display_data( interaction_sn, scenes, script );
			 update_relation_viz();
			 update_noun_scene_presence_details();
		     } )
		.on( 'mouseover', function ( d, i ) { 
		    d3.select( '#sv_col' + i ).attr( 'class', 'highlighted' ); 
		    d3.select( '#rel_col' + i ).attr( 'class', 'highlighted' ); 
		} )
		.on( 'mouseout', function ( d, i ) { 
		    d3.select( '#sv_col' + i ).attr( 'class', 'subtle' ); 
		    d3.select( '#rel_col' + i ).attr( 'class', 'subtle' ); 
		} );

	    cell.transition().duration( duration )
		.attr( 'class', 'cell' )
		.attr( 'x', function( d, i ) { 
		    return x( scene_first[i]+i*x_padding );
		} )
		.attr( 'width', function ( d, i ) { return x( scene_lines[i] ); } )
		.attr( 'height', box_height )
		.style( 'fill-opacity', 
			function ( d, i ) { 
			    if ( max_presence_density > 0 ) {
				return Math.sqrt( ( d / scene_lines[i] ) / max_presence_density );
			    } else {
				return 0;
			    }
			} 
		      );
	}
    }    


    ///////////////////////////////////////////////////////
    // relation_viz helpers.
    ///////////////////////////////////////////////////////

    function draw_relation_viz() {
	create_relation_viz();
	update_relation_viz();
    }

    function create_relation_viz() {
	var svg = d3.select( '#relation_div' )
	    .append( 'svg' )
	    .attr( 'id', 'relation_viz' )
	    .attr( 'width', sv_width )
	    .attr( 'height', sv_height )
	    .append( 'g' )
	    .attr( 'transform', 'translate(' + margin.left + ',' + margin.top + ')' );
    }
    
    function update_relation_viz() {
	var current_noun = selection.current_noun;

	if ( current_noun ) {
	    $( "#relation_title" ).text( current_noun.titleCase() + "'s Relationships:" );
	} else {
	    $( "#relation_title" ).text( "Relationships (click a box above to select a subject)" )
	}

	d3.select( '#relation_viz' )
	    .transition().duration( duration )
	    .attr( 'width', sv_width )
	    .attr( 'height', sv_height );
	
	var svg = d3.select( '#relation_viz g' );

	var x = d3.scale.linear()
	    .domain( [0, total_lines+scene_lines.length*x_padding] )
	    .range( [0, sv_width - margin.left - margin.right] );

	var row = svg.selectAll( '.rel_row' )
	    .data( relation_to, function ( d ) { return d.name; } );

	row.enter()
	    .append( 'g' )
	    .attr( 'class', 'rel_row' )
	    .append( 'text' )
	    .attr( 'x', -6 )
	    .attr( 'y', box_height/2 )
	    .attr( 'dy', '.32em' )
	    .attr( 'text-anchor', 'end' )
	    .text( function ( d ) { return d.name.titleCase(); } )
	    .style( 'font', '10px sans-serif' );


	row.transition().duration( duration )
	    .attr( 'fill', function ( d, i ) { 
		return color( d.name );
	    } )
	    .attr( 'transform',  
		   function( d, i ) { 
		       return 'translate( 0, ' + ( box_height+y_padding )*( i+1 ) + ')'; 
		   } 
		 )
	    .each( row_update );

	row.exit()
	    .transition().duration( duration )
	    .style( 'fill-opacity', 0)
	    .attr( 'transform', function ( d, i ) {
		return 'translate( 0,' + sv_height + ')';
	    } )
	    .remove();

	var column = svg.selectAll( '.rel_column' )
	    .data( scene_first, function ( d ) { return d+1; } );

	column.enter()
	    .append( 'g' )
	    .append( 'text' )
	    .attr( 'x', function ( d, i ) { return x(scene_lines[i]) / 2; } )
	    .attr( 'y', box_height / 2 )
	    .attr( 'text_anchor', 'middle' )
	    .attr( 'font-size', '.5em' )
	    .text( function ( d, i ) { return i+1; } )
	    .attr( 'id', function ( d, i ) { return 'rel_col'+i; } )
	    .attr( 'class', 'subtle' )
	    .on( 'mouseover', function ( d, i ) { 
		d3.select( '#sv_col' + i ).attr( 'class', 'highlighted' ); 
		d3.select( '#rel_col' + i ).attr( 'class', 'highlighted' ); 
	    } )
	    .on( 'mouseout', function ( d, i ) { 
		d3.select( '#sv_col' + i ).attr( 'class', 'subtle' ); 
		d3.select( '#rel_col' + i ).attr( 'class', 'subtle' ); 
	    } )
	    .on( 'click', function( d, i ) {
		selection.current_scene = i+1; 
		update_scene_graph(); 
		update_noun_scene_presence_details();
	    } );


	column.attr( 'class', 'rel_column' )
	    .attr( 'transform', function ( d, i ) { return 'translate(' + x(d+i*x_padding) + ', 0)'; } );


	function row_update( row ) {
	    var cell = d3.select( this )
		.selectAll( '.rel_cell' )
		.data( row.interactions );

	    cell.enter()
		.append( 'rect' )
		.style( 'fill-opacity', 0 )
		.on( 'click', function ( d, i ) { 
		    selection.current_noun = row.name; 
		    selection.current_scene = i+1; 
		    update_scene_graph(); 
		    update_noun_scene_presence_details();
		} )
		.on( 'mouseover', function ( d, i ) { 
		    d3.select( '#sv_col' + i ).attr( 'class', 'highlighted' ); 
		    d3.select( '#rel_col' + i ).attr( 'class', 'highlighted' ); 
		} )
		.on( 'mouseout', function ( d, i ) { 
		    d3.select( '#sv_col' + i ).attr( 'class', 'subtle' ); 
		    d3.select( '#rel_col' + i ).attr( 'class', 'subtle' ); 
		} );

	    cell.transition().duration( duration )
		.attr( 'class', 'rel_cell' )
		.attr( 'x', function( d, i ) { 
		    return x( scene_first[i]+i*x_padding );
		} )
		.attr( 'width', function ( d, i ) { return x( scene_lines[i] ); } )
		.attr( 'height', box_height )
		.style( 'fill-opacity', 
			function ( d, i ) { 
			    if ( max_relation_density > 0 ) {
				return Math.sqrt( ( d / scene_lines[i] ) / max_relation_density );
			    } else {
				return 0;
			    }
			} 
		      );
	}
    }    

    ///////////////////////////////////////////////////////
    // Graph helpers.
    ///////////////////////////////////////////////////////

    function draw_scene_graph() {
	create_scene_graph();
	update_scene_graph();
    }

    function create_scene_graph() {
	var graph = d3.select( '#graph_div' )
	    .append( 'svg' )
	    .attr( 'id', 'graph_viz' )
	    .attr( 'width', g_width )
	    .attr( 'height', g_height );

	g_force = d3.layout.force()
	    .charge( g_charge )
	    .linkDistance( g_link_distance )
	    .size( [g_width,g_height] );
    }

    function update_scene_graph() {
	var current_scene = selection.current_scene;

	max_node_interactions = 0;
	max_link_interactions = 0;

	var svg = d3.select( '#graph_viz' );

	if ( current_scene !== false ) {
	    if ( scenes.scenes[current_scene] !== undefined ) {
		var first_page = script[scenes.scenes[current_scene].first_line - 1].page_no;
		var last_page = script[scenes.scenes[current_scene].last_line - 1].page_no;
		var pp = "";
		if ( first_page != last_page ) {
		    pp = ' p. '+first_page+'-'+last_page;
		} else {
		    pp = ' p. '+first_page;
		}
		$( '#graph_title' ).text( "Scene " + current_scene + pp + " Interactions: " + script[scenes.scenes[current_scene].heading_line - 1].content );
	    } else {
		$( '#graph_title' ).text( "Scene " + current_scene );
	    }
	}

	var nodes = g_force.nodes();

	var new_nodes = d3.keys( interaction_sn[current_scene] )
	    .filter( function ( n ) { return selection['noun_types'][noun_types[n]]; } )
	    .sort()
	    .map( function ( d ) { return { 'name':d }; } );

	// Update nodes removing any nouns not in current_nouns, and
	// adding any nouns in current_nouns not in nodes already.
	update_nodes( nodes, new_nodes, g_force.links() );

	var node_index = {};
	nodes.forEach( function( n, i ) {
	    node_index[n.name] = i;
	    if ( n.name == selection.current_noun ) {
		n.x = g_width / 2;
		n.y = g_height / 2;
		n.fixed = true;
	    } else {
		n.fixed = false;
	    }
	} );

	var links = g_force.links();

	var new_links = d3.entries( interaction_sn[current_scene] )
	    .filter( function ( entry ) { return node_index[entry.key] !== undefined; } )
	    .map( function ( entry ) {
		var source_key = entry.key;
		var target_keys = entry.value;
		var source_interactions = 0;
		var result = d3.keys( target_keys )
		    .filter( function ( target_key ) { return node_index[target_key] !== undefined; } )
		    .map( 
			function ( target_key ) {
			    var interactions = interaction_sn[current_scene][source_key][target_key]
				.filter( function ( i ) { 
				    return ( ( selection.presence_types[i.a.presence_type] ) && 
					     ( selection.presence_types[i.b.presence_type] ) && 
					     ( selection.interaction_types[i.interaction_type] ) );
				} );
				source_interactions += interactions.length
			    if ( source_interactions > max_node_interactions ) {
				max_node_interactions = source_interactions;
			    }
			    if ( interactions.length > max_link_interactions ) {
				max_link_interactions = interactions.length;
			    }
			    return { 
				'source': node_index[source_key], 
				'target': node_index[target_key],
				'interactions': interactions.length
			    };
			}
		    )
		    .filter( function ( l ) { return l.interactions; } );
		nodes[node_index[source_key]]['interactions'] = source_interactions;
		return result;
	    } );

	if ( new_links.length ) {
	    new_links = Array.prototype.concat.apply( [], new_links );
	}
	
	update_links( links, new_links, nodes );

	var r = d3.scale.sqrt()
	    .domain( [0, max_node_interactions ] )
	    .range( [2, 10 ] );
		    
	var fo = d3.scale.linear()
	    .domain( [0, max_link_interactions ] )
	    .range( [.1, 1] );

	var sw = d3.scale.sqrt()
	    .domain( [0, max_link_interactions ] )
	    .range( [.5, 2] );

	var node = svg.selectAll( '.node' )
	    .data( nodes, function ( d ) { return d.name; } );

	node.selectAll( 'circle' )
	    .transition().duration( duration )
	    .attr( 'r', function ( d ) { return r( d.interactions ); } );

	var nodeEntry = node.enter()
	    .append( 'g' )
	    .attr( 'class', 'node' )
	    .call( g_force.drag );
	
	nodeEntry.append( 'circle' )
	    .style( 'stroke', '#fff' )
	    .attr( 'class', 'circle' )
	    .attr( 'r', function ( d ) { return r( d.interactions ); } )
	    .attr( 'fill', function (d) { return color( d.name ); } )

	nodeEntry.append( 'text' )
	    .attr( 'dx', 12 )
	    .attr( 'dy', '.35em' )
	    .style( 'font', '10px sans-serif' )
	    .text( function ( d ) { return d.name.titleCase(); } );
	
	node.exit()
	    .transition().duration( duration )
	    .style( 'fill-opacity', 0 )
	    .remove();

	// Order here is important - we want the nodes to exist so we
	// can have a consistent way of referring to their endpoints
	// for the links below.  g_force.start converts our nodes data
	// structure from having indecies to references to nodes.
	g_force.start();

	var link = svg.selectAll( '.link' )
	    .data( links, function ( d ) { return d.source.name + '-' + d.target.name; } );

	link.transition().duration( duration )
	    .attr( 'stroke-opacity', function ( d ) { return fo( d.interactions ); } )
	    .attr( 'stroke-width', function ( d ) { return sw( d.interactions ); } );	

	link.enter()
	    .append( 'line' )
	    .attr( 'class', 'link' )
	    .style( 'stroke', '#333' )
	    .attr( 'stroke-opacity', function ( d ) { return fo( d.interactions ); } )
	    .attr( 'stroke-width', function ( d ) { return sw( d.interactions ); } );

	link.exit()
	    .transition().duration( duration )
	    .style( 'stroke-opacity', 0 )
	    .remove();

	g_force.on("tick", function() {
	    link.attr("x1", function(d) { return d.source.x; })
		.attr("y1", function(d) { return d.source.y; })
		.attr("x2", function(d) { return d.target.x; })
		.attr("y2", function(d) { return d.target.y; });
	    
	    node.attr( 'transform', function ( d ) { return 'translate(' + d.x + ',' + d.y + ')'; } );
	} );

    }

    function update_nodes( nodes, new_nodes, links ) {
	function get_noun_index( noun ) {
	    for (var i in nodes) {if (nodes[i]['name'] === noun) return i};
	    return -1;
	}

	var old_nouns = {};
	nodes.forEach( function ( n ) {
	    old_nouns[n.name] = true;
	} );
	
	var new_nouns = {};
	new_nodes.forEach( function ( n ) {
	    new_nouns[n.name] = true;
	} );

	// If something is in old_nouns but not new_nouns, delete it
	// from nodes.
	d3.keys( old_nouns )
	    .forEach( function ( n ) { 
		if ( !new_nouns[n] ) {
		    var i = get_noun_index( n );
		    remove_links_for_node( links, nodes[i] );
		    nodes.splice( i, 1 );
		}
	    } );

	// If something is new new_nouns but not old_nouns, add it to
	// nodes.
	d3.keys( new_nouns )
	    .forEach( function ( n ) {
		if ( !old_nouns[n] ) {
		    nodes.push( { 'name':n } );
		}
	    } );
    }

    function remove_links_for_node( links, n ) {
	var i = 0;
	while (i < links.length) {
            if ((links[i]['source'] == n)||(links[i]['target'] == n)) {
		links.splice(i,1)
	    } else {
		i++;
	    }
        }
    }

    function update_links( links, new_links, nodes ) {
	// We seek to uniquely identify a link based on the names of
	// its endpoints, this avoids unintentional homonyms where,
	// for example, we have name A, AB, BC, and C, where we could
	// get confused about a A-BC and a AB-C link.
	var sep = "-unlikely to\ncollide-";

	var new_link_names = {};
	new_links.forEach( function ( l, i ) {
	    new_link_names[nodes[l.source].name + sep + nodes[l.target].name] = { 'index':i, 'interactions':l.interactions };
	} );

	var old_links = {};
	links.forEach( function ( l, i ) {
	    old_links[l.source.name + sep + l.target.name] = true;
	    if ( new_link_names[l.source.name + sep + l.target.name] !== undefined ) {
		// The link also exists in the new data, update its interaction count.
		l.interactions = new_link_names[l.source.name + sep + l.target.name].interactions;
	    }
	} );
		       
	// If something is in new_links but not links, add it to links.
	d3.keys( new_link_names )
	    .forEach( function ( l ) {
		if ( old_links[l] === undefined ) {
		    links.push( new_links[new_link_names[l].index] );
		} 
	    } );
	
	d3.keys( old_links )
	    .forEach( function ( l ) {
		if ( new_link_names[l] === undefined ) {
		    remove_link_with_name( l, sep );
		}
	    } );
    }

    function remove_link_with_name( name, sep ) {
	var links = g_force.links();
	var i = 0;
	while ( i < links.length ) {
	    if ( links[i].source.name+sep+links[i].target.name === name ) {
		links.splice(i, 1);
	    } else {
		i++;
	    }
	}
    }

    ///////////////////////////////////////////////////////
    // Noun Presence Details
    ///////////////////////////////////////////////////////

    function draw_noun_scene_presence_details() {
	create_noun_scene_presence_details();
	update_noun_scene_presence_details();
    }

    function create_noun_scene_presence_details() {
	var svg = d3.select( '#noun_scene_presence_details_div' )
	    .append( 'svg' )
	    .attr( 'id', 'noun_scene_presence_details_viz' )
	    .attr( 'width', nspd_width )
	    .attr( 'height', nspd_height )
	    .append( 'g' );
	//	    .attr( 'transform', 'translate(' + margin.left + ',' + margin.top + ')' );
    }

    function update_noun_scene_presence_details() {
	// Populate nps_data with the latest data from presence_ns
	// about the current noun and scene.
	refresh_noun_scene_presence_details();

	d3.select( '#noun_scene_presence_details_viz' )
	    .transition().duration( duration )
	    .attr( 'width', nspd_width )
	    .attr( 'height', nspd_height );
	
	var svg = d3.select( '#noun_scene_presence_details_viz g' );

	// DEBUG - Add a list of vertical bars for each presence in the scene.

	// DEBUG - Add event handlers so bars are redrawn when new
	// selectors are entered.

	// nsp_details is the filtered set of presence objects for our
	// current context, [ { presence obj }, ... ], presence obj is
	// name, noun_type, presence_type, where : { line_no, page_no,
	// scene_id }

	var x = d3.scale.linear()
	    .domain( [0, scene_lines[selection.current_scene - 1] ] )
	    .range( [0, nspd_width] );

	var line = svg.selectAll( '.line' )
	    .data( nsp_details, function ( d ) { return d.where.line_no; } );

//	column.enter()
//	    .append( 'g' )
//	    .append( 'text' )
//	    .attr( 'x', function ( d, i ) { return x(scene_lines[i]) / 2; } )
//	    .attr( 'y', box_height / 2 )
//	    .attr( 'text_anchor', 'middle' )
//	    .attr( 'font-size', '.5em' )
//	    .text( function ( d, i ) { return i+1; } )
//	    .attr( 'id', function ( d, i ) { return 'sv_col'+i; } )
//	    .attr( 'class', 'subtle' )
//	    .on( 'mouseover', function ( d, i ) { 
//		d3.select( '#sv_col' + i ).attr( 'class', 'highlighted' ); 
//		d3.select( '#rel_col' + i ).attr( 'class', 'highlighted' ); 
//	    } )
//	    .on( 'mouseout', function ( d, i ) { 
//		d3.select( '#sv_col' + i ).attr( 'class', 'subtle' ); 
//		d3.select( '#rel_col' + i ).attr( 'class', 'subtle' ); 
//	    } )
//	    .on( 'click', function( d, i ) {
//		selection.current_scene = i+1; 
//		update_scene_graph(); 
//	    } );

//	column.attr( 'class', 'column' )
//	    .attr( 'transform', function ( d, i ) { return 'translate(' + x(d+i*x_padding) + ', 0)'; } );

	line.enter()
	    .append( 'rect' )
	    .attr( 'class', 'line' )
	    .style( 'fill-opacity', 1 )
	    .attr( 'x', function( d, i ) { 
		console.log( 'd is', d )
		console.log( 'Line number is', d.where.line_no )
		console.log( 'Current scene is', selection.current_scene )
		console.log( 'Current scene first line is', scene_first[selection.current_scene - 1 ] )
		return x( d.where.line_no - scene_first[selection.current_scene - 1] );
	    } )
	    .attr( 'width', function ( d, i ) { return 2; } )
	    .attr( 'height', nspd_height );

	line.exit().remove();
    }

    ///////////////////////////////////////////////////////
    // Event handlers and data processing.
    ///////////////////////////////////////////////////////

    function update_noun_types( event ) {
	selection['noun_types'][event.target.value] = event.target.checked;

	// If we just excluded the 'current_noun' by selection, unset the current noun.
	if ( selection.current_noun && !( selection['noun_types'][noun_types[selection.current_noun]] ) ) {
	    selection.current_noun = false;
	}

	refresh_presence_display_data( presence_sn, scenes, script );
	refresh_relation_display_data( interaction_sn, scenes, script );
	update_script_viz();
	update_scene_graph();
	update_relation_viz();
    }

    function update_presence_types( event ) {
	selection['presence_types'][event.target.value] = event.target.checked;
	refresh_presence_display_data( presence_sn, scenes, script );
	refresh_relation_display_data( interaction_sn, scenes, script );	
	update_script_viz();
	update_scene_graph();
	update_relation_viz();
    }

    function update_interaction_types( event ) {
	selection['interaction_types'][event.target.value] = event.target.checked;
	refresh_relation_display_data( interaction_sn, scenes, script );
	update_scene_graph();
	update_relation_viz();
    }

    function update_top_n( event ) {
	var new_n = Number( event.target.value );
	if ( new_n && ( new_n > 0 ) ) {
	    selection['top_n'] = new_n;
	}
	refresh_presence_display_data( presence_sn, scenes, script );
	refresh_relation_display_data( interaction_sn, scenes, script );
	sv_height = ( Math.min( selection['top_n'], presence.length ) + 1 )*( box_height + y_padding );
	update_script_viz();
	update_relation_viz();
    }

    function refresh_presence_display_data( presence_sn, scenes, script ) {
	// Scenes sorted in ascending order.
	var scene_ids = d3.keys( scenes['scenes'] );
	scene_ids = scene_ids.sort( function ( a, b ) { return a-b; } )
	
	// Compute the total number of lines.
	total_lines = scenes['scenes'][scene_ids.slice(-1)].last_line - scenes['scenes'][scene_ids[0]].first_line + 1;
	
	// Compute the number of lines in each scene.
	scene_lines = scene_ids.map( 
	    function ( d ) {
		return scenes['scenes'][d].last_line - scenes['scenes'][d].first_line + 1;
	    }
	);
	
	// Compute the first line in each scene.
	scene_first = scene_ids.map( 
	    function ( d ) {
		return scenes['scenes'][d].first_line;
	    }
	);

	// Get a list of all nouns anywhere in the script.
	var noun_ids = d3.set( 
	    d3.merge( 
		d3.keys( presence_sn ).map( 
		    function( d ) { 
			return d3.keys( presence_sn[d] ); 
		    } 
		) 
	    ) 
	).values().sort();

	// Pare the list down to those that match our desired types.
	noun_ids = noun_ids.filter( function ( n ) { return selection['noun_types'][noun_types[n]]; } );

	// DEBUG REMOVE add stuff here to populate nsp_details.
//	var current_noun = selection.current_noun;
//	if ( current_noun && !selection['noun_types'][noun_types[current_noun]] ) {
//	    console.log( "ERROR: current noun", current_noun, "is not present in our selection of nouns." );
//	}
//	var current_scene = selection.current_scene;

	presence = noun_ids.map( function ( name ) {
	    return {
		'name': name,
		'noun_type': noun_types[name],
		'presence': scene_ids.map( 
		    function ( scene_id ) {
			if ( presence_sn[scene_id] ) {
			    if ( presence_sn[scene_id][name] ) {
				var appear = presence_sn[scene_id][name].filter(
				    function ( p ) {
					return selection['presence_types'][p['presence_type']];
				    }
				)
// DEBUG - Remove
//				if ( current_noun == name && current_scene == scene_id ) {
//				    console.log( "Found match for", name, " ", scene_id, appear );
//				    nsp_details = appear;
//				}
				return appear.length;
			    } else {
				return 0;
			    }
			}
		    }
		)
	    };
	} );

	presence = presence.sort( 
	    function ( a, b ) {
		return d3.sum( b.presence ) - d3.sum( a.presence );
	    }
	).slice( 0, Math.min( noun_ids.length, selection['top_n'] ) );

	max_presence_density = 0;
	refresh_max_presence_density( presence );
    }

    // Called when we select a new noun or scene, or otherwise alter
    // selection criteria in a way that could cause us to have altered
    // data in noun_scene_presence_details.
    function refresh_noun_scene_presence_details( ) { 
	var current_noun = selection.current_noun;
	var current_scene = selection.current_scene;

	if ( ( current_scene in presence_sn ) && ( current_noun in presence_sn[current_scene] ) ) {
	    nsp_details = presence_sn[current_scene][current_noun].filter( 
		function( p ) { 
		    return selection['presence_types'][p['presence_type']]; 
		} );
	} else {
	    console.log( "Current scene and noun not present in presence_sn.  Scene:", current_scene, "Noun:", current_noun );
	}
    }

    function refresh_max_presence_density( presence ) {
	presence.forEach( 
	    function ( noun ) {
		noun['presence'].forEach( 
		    function ( appear, scene_id ) {
			if ( max_presence_density < ( appear / scene_lines[scene_id] ) ) {
			    if ( appear / scene_lines[scene_id] > 1 ) {
				console.log('appear',appear,'scene',scene_id,'lines',scene_lines[scene_id]);
			    }
			    max_presence_density = appear / scene_lines[scene_id];
			}
		    }
		);
	    } 
	);
    }

    function refresh_relation_display_data( interaction_sn, scenes, script ) {
	// Scenes sorted in ascending order.
	var scene_ids = d3.keys( scenes['scenes'] );
	scene_ids = scene_ids.sort( function ( a, b ) { return a-b; } )
	
	var current_noun = selection.current_noun;

	// Get a list of all nouns that relate to the current noun.
	var noun_ids = d3.set( 
	    d3.merge( 
		d3.keys( interaction_sn ).map( 
		    function( d ) { 
			if ( interaction_sn[d][current_noun] !== undefined ) {
			    return d3.keys( interaction_sn[d] ); 
			} else {
			    return [];
			}
		    } 
		) 
	    ) 
	).values().sort();

	// Pare the list down to those that match our desired types.
	noun_ids = noun_ids.filter( function ( n ) { return selection['noun_types'][noun_types[n]]; } );

	relation_to = noun_ids.map( function ( name ) {
	    return {
		'name': name,
		'noun_type': noun_types[name],
		'interactions': scene_ids.map( 
		    function ( scene_id ) {
			if ( interaction_sn[scene_id] && 
			     interaction_sn[scene_id][current_noun] && 
			     interaction_sn[scene_id][current_noun][name] ) {
			    var interact = interaction_sn[scene_id][current_noun][name].filter(
				function ( i ) {
				    return ( ( selection.presence_types[i.a.presence_type] ) &&
					     ( selection.presence_types[i.b.presence_type] ) &&
					     ( selection.interaction_types[i.interaction_type] ) )
				}
			    ).length;
			    return interact;
			} else {
			    return 0;
			}
		    }
		)
	    };
	} );

	relation_to = relation_to.sort( 
	    function ( a, b ) {
		return d3.sum( b.interactions ) - d3.sum( a.interactions );
	    }
	).slice( 0, Math.min( noun_ids.length, selection['top_n'] ) );

	max_relation_density = 0;
	refresh_max_relation_density( relation_to );
    }

    function refresh_max_relation_density( relation_to ) {
	relation_to.forEach( 
	    function ( noun ) {
		noun['interactions'].forEach( 
		    function ( interaction, scene_id ) {
			if ( max_relation_density < ( interaction / scene_lines[scene_id] ) ) {
			    if ( interaction / scene_lines[scene_id] > 1 ) {
				console.log('interaction',interaction,'scene',scene_id,'lines',scene_lines[scene_id]);
			    }
			    max_relation_density = interaction / scene_lines[scene_id];
			}
		    }
		);
	    } 
	);
    }
    
}
