'''Parser, takes in an array of lines where each line is represented
by a dictionary with line_no, page_no, and content fields, and returns
a script data structure of the following format:

script = {
          front : { start_line : 1, end_line : Y }
          scenes : { scene_number : 2,
                     heading_line : 13,
                     first_line : 13
                     last_line : 29
                     scene_blocks : [
                         { block_type : ACTION | DIALOG
                           first_line : 15
                           last_line : 19
                           line_types : { line_no : ACTION, DIALOG_HEADER, ... }
                         },
                     ]
                   }
          }
'''
import nltk
nltk.data.path.append( '/app/illuminator/nltk_data' )
from nltk.tokenize import word_tokenize, sent_tokenize, RegexpTokenizer
import itertools
import re

STRICT = 'STRICT'
FUZZY = 'FUZZY'
mode = STRICT

def is_empty_line( line ):
    '''Nothing but whitespace'''

    if re.search( r'^\s*$', line ):
        return True
    else:
        return False

def is_scene_header( line ):
    '''scene_heading := \n{0,1}, ^[scene_number], location, [time], 
                        [scene_number], \n+
       location := [(INT., INTERNAL, EXT., EXTERNAL)] LOCATION_NAME.AZ [-]
       time := [(DAY, NIGHT, CONTINUOUS, ARBITRARY_TEXT.AZ)]'''

    # Accept lines that begin with a nonwhitespace,
    # non-lowercase character, and then have no lowercase
    # characters, and have at least one word character in them
    if mode == STRICT:
        if re.search( r'^[^\sa-z][^a-z]+$', line ) and (
            line.startswith('INTERIOR') or line.startswith('EXTERIOR') 
            or line.startswith('INT.') or line.startswith('EXT.') ):
            return True
        else:
            return False
    elif mode ==FUZZY:
        if re.search( r'^[^\sa-z][^a-z]+$', line ):
            if re.search( r'\w', line ):
                return True
            
        return False
            
def is_start_continue( line ):
    '''start_continue := ^\s*(\s*CONTINUED\s*)\s*$'''
    if re.search( r'^\s*\(\s*CONTINUED\s*\)\s*$', line ):
        return True
    else:
        return False

def is_end_continue( line ):
    '''end_continue := ^\s*CONTINUED:\s*(\(\d+\))?\s*$'''
    if re.search( r'^\s*CONTINUED:\s*(\(\d+\))?\s*$', line ):
        return True
    else:
        return False

def is_page_num( line ):
    '''direction := ^\s+\d+\.?$'''
    if re.search( r'^\s+\d+\.?$', line ):
        return True
    else:
        return False

def is_direction( line ):
    '''direction := ^\s+[^a-z]+:$'''
    if re.search( r'^\s+[^a-z]+:$', line ):
        return True
    else:
        return False

def is_action( line ):
    '''action := ^sentence+, \n+
       sentence := English sentences without blank lines, each line 
                   begins without whitespace'''
    
    # Accept lines that begin with a nonwhitespace characters
    # only.
    if re.search( r'^[^\s]', line ):
        return True
    else:
        return False

def is_dialog_header( line ):
    '''dialog := dialog_header.center, [parenthetical].center, line.center+
       dialog_header := CHARACTER_NAME.AZ.center, dialog_details*, \n
       dialog_details := ( \(V.O.\), \(O.S.\), \(O.C.\) )'''

    # Look for a line beginning with whitespace followed by
    # non-lowercase text.
    if ( re.search( r'^\s+[^a-z]+$', line ) ):
        return True
    else:
        return False


def is_dialog( line ):
    '''dialog := dialog_header.center, [parenthetical].center, line.center+
       parenthetical := ( english text ).center, \n
       line := English text, each line begins with whitespace'''

    # Ensure all content lines begin with whitespace.
    if re.search( r'^[^\s]', line ):
        return False
    else:
        return True

def get_types( line, next_line, prior_types ):

    prior_block_type = prior_types[0]
    prior_line_type = prior_types[1]

    if ( prior_block_type == FRONT ):
        if ( not is_scene_header( line ) ):
            if ( is_empty_line( line ) ):
                return ( FRONT, EMPTY )
            else:
                return ( FRONT, FRONT )

    if ( is_start_continue( line ) ):
        return ( prior_block_type, CONTINUED )
    
    if ( prior_line_type == CONTINUED ):
        if ( is_end_continue( line ) ):
            return ( prior_block_type, RESUMED )
        else:
            return ( prior_block_type, CONTINUED )

    if ( is_page_num( line ) ):
        return ( PAGE_NUM, PAGE_NUM )

    if ( is_empty_line( line ) ):
        if ( prior_block_type == DIALOG and prior_line_type == DIALOG_HEADER ):
            print "EMPTY LINE CAN'T FOLLOW A DIALOG HEADER!"
            return ( ERROR, EMPTY )

        if ( prior_block_type == DIALOG and prior_line_type == DIALOG
             and next_line and is_dialog_header( next_line ) ):
                return ( DIALOG, EMPTY )
        elif ( prior_block_type == DIALOG and prior_line_type == RESUMED ):
            return ( DIALOG, EMPTY )
        
        return ( EMPTY, EMPTY )

    if ( is_direction( line ) ):
        if ( prior_line_type != EMPTY ):
            print "DIRECTION MUST FOLLOW EMPTY LINE!"
            return ( ERROR, DIRECTION )
        else:
            return ( DIRECTION, DIRECTION )

    if ( is_scene_header( line ) ):
        if ( next_line and is_action( next_line ) 
             or prior_block_type == ACTION ):
            # Special cases for action lines that are in all caps.
            return ( ACTION, ACTION )
        elif ( prior_block_type in [ EMPTY, FRONT ] or prior_line_type == EMPTY ):
            return ( SCENE_HEADING, SCENE_HEADING )
        else:
            print "SCENE_HEADING HEADER MUST FOLLOW EMPTY LINE OR FRONT!"
            return ( ERROR, SCENE_HEADING )

    if ( is_action( line ) ):
        if ( prior_block_type in [ EMPTY, ACTION ] or prior_line_type == EMPTY ):
            return ( ACTION, ACTION )
        else:
            print "ACTION MUST FOLLOW EMPTY LINE OR ACTION!"
            return ( ERROR, ACTION )

    if ( is_dialog_header( line ) ):
        if ( prior_line_type in [ DIALOG, DIALOG_HEADER ] ):
            # This case arises when dialog is in all caps.
            return ( DIALOG, DIALOG )
        if ( prior_block_type in [ EMPTY, DIALOG ] and prior_line_type == EMPTY):
            return ( DIALOG, DIALOG_HEADER )
        else:
            print "DIALOG HEADER MUST FOLLOW EMPTY LINE OR DIALOG"
            return ( ERROR, DIALOG_HEADER )

    if ( is_dialog( line ) ):
        if ( prior_block_type == DIALOG 
             and prior_line_type in [ DIALOG_HEADER, DIALOG ] ):
            return ( DIALOG, DIALOG )
        else:
            print "DIALOG MUST FOLLOW DIALOG HEADER OR DIALOG"
            return ( ERROR, DIALOG )

    print "Line: '", line, "'"
    print "UNHANDLED LINE TYPE!"
    return ( ERROR, ERROR )


# Parser states / line types.
ERROR = 'ERROR'
FRONT = 'FRONT'
EMPTY = 'EMPTY'
SCENE_HEADING = 'SCENE_HEADING'
ACTION = 'ACTION'
DIALOG_HEADER = 'DIALOG_HEADER'
DIALOG = 'DIALOG'
DIRECTION = 'DIRECTION'
CONTINUED = 'CONTINUED'
RESUMED = 'RESUMED'
PAGE_NUM = 'PAGE_NUM'

def parse_script_lines( script_lines ):
    types = ( FRONT, FRONT )
    prior_types = ( FRONT, FRONT )

    script = {
        'front': { 'first_line' : 0, 'last_line'  : 0 },
        'scenes': {},
        }
    current_scene = {
        'scene_number' : 0,
        'heading_line' : 1,
        'first_line'   : 1,
        'last_line'    : 1,
        'scene_blocks' : []
        }
    current_block = {
        'block_type' : EMPTY,
        'first_line' : 1,
        'last_line'  : 1,
        'line_types' : { 1 : EMPTY }
        }

    for ( i, line_dict ) in enumerate( script_lines ):
        line = line_dict['content']
        line_no = line_dict['line_no']
        page_no = line_dict['page_no']

        next_line = False
        if ( i + 1 < len( script_lines ) ):
            next_line = script_lines[ i + 1 ]['content']
        
        types = get_types( line=line, next_line=next_line, prior_types=prior_types )

        if ( types[0] == FRONT ):
            script['front']['first_line'] = 1
            script['front']['last_line'] = line_no
            continue

        if ( types[0] == ERROR ):
            print "Error - Page, Line, Content:\n", page_no, line_no, line
            print "Prior block_type, line types were: ", prior_types[0], prior_types[1]

            current_block['block_type'] = prior_types[0]
            current_scene['scene_blocks'].append( current_block )

            current_block = {
                'block_type' : types[0],
                'first_line' : line_no,
                'last_line'  : line_no,
                'line_types' : { str( line_no ) : types[1] }
                }
            prior_types = types
            continue

        if ( types[0] == prior_types[0] ):
            current_block['last_line'] = line_no
            current_block['line_types'][ str( line_no ) ] = types[1]
        else:
            current_scene['scene_blocks'].append( current_block )

            current_block = {
                'block_type' : types[0],
                'first_line' : line_no,
                'last_line'  : line_no,
                'line_types' : { str( line_no ) : types[1] }
                }

            if ( types[0] == SCENE_HEADING ):
                current_scene['last_line' ] = line_no - 1
                script['scenes'][str( current_scene['scene_number'] )] = current_scene
                
                current_scene = {
                    'scene_number' : current_scene['scene_number'] + 1,
                    'heading_line' : line_no,
                    'first_line'   : line_no,
                    'last_line'    : line_no,
                    'scene_blocks' : [ ]
                    }

        prior_types = types

    # Append the terminal block and scene
    current_scene['scene_blocks'].append( current_block )
    current_scene['last_line'] = line_no

    script['scenes'][str( current_scene['scene_number'] )] = current_scene

    # Delete the stub scene we seeded the data structure with.
    del script['scenes']['0']

    return script
                  
# Noun types
CHARACTER = 'CHARACTER'
THING = 'THING'
LOCATION = 'LOCATION'

# Interaction types
SETTING = 'SETTING' # When a noun is mentioned in a scene whose
                    # setting is defined by the location for the
                    # scene. The location will be the first party in
                    # the interaction.
DISCUSS = 'DISCUSS' # When two characters have lines in the same
                    # dialog block.  Order is not defined.
MENTION = 'MENTION' # When the first party speaks the name of the
                    # second in dialog.
APPEAR  = 'APPEAR'  # When two nouns appear in the same sentence.



'''
A noun === ( name, noun_type )
A where === scene_id, page_no, line_no
A presence === name : name, noun_type : type, where : where, presence_type
An interaction === a : presence, b : presence, where : where, interaction_type: type
'''

presences = []

# Keyed on name, values are type (the type of noun), and scene_id
# (leads to array of presences for this noun in that scene). This type
# is the authoritative type for this noun, elsewhere types simply
# indicate the type detected by the parser at that point.
presence_ns = {}

presence_sn = {}
interactions = []
interaction_ns = {}
interaction_sn = {}

def reset_parser_state():
    global mode
    mode = STRICT

    del presences[:]
    presence_ns.clear()
    presence_sn.clear()
    del interactions[:]
    interaction_ns.clear()
    interaction_sn.clear()

'''
def reset_parser_state():
    global presences, presence_ns, presence_sn, interactions, interaction_ns, interaction_sn, mode
    presences = []
    presence_ns = {}
    presence_sn = {}
    interactions = []
    interaction_ns = {}
    interaction_sn = {}
    mode = STRICT
'''

def compute_presence_and_interactions( script_lines, script, parse_mode=STRICT ):
    global mode
    mode = parse_mode
    for scene_id in sorted( script['scenes'], key=int ):
        scene_location = {}
        for block in script['scenes'][scene_id]['scene_blocks']:

            if block['block_type'] == SCENE_HEADING:
                line = script_lines[block['first_line'] - 1]
                name = get_scene_location( line['content'] )
                scene_location = get_presence( noun=( name, LOCATION ), presence_type=SETTING, 
                                               scene_id=scene_id, page_no=line['page_no'], 
                                               line_no=line['line_no'] )

                if name in presence_ns and presence_ns[name]['noun_type'] == CHARACTER:
                    print "ERROR: Encountered", name, "in the context of a scene heading - ignoring."
                else:
                    update_presence( scene_location )

            elif block['block_type'] in [ACTION, DIRECTION]:
                update_presence_and_interactions_for_lines( script_lines=script_lines, 
                                                            first_line=block['first_line'], 
                                                            last_line=block['last_line'], 
                                                            scene_id=scene_id, scene_location=scene_location )
                
            elif block['block_type'] == DIALOG:
                update_presence_and_interactions_for_dialog( script_lines=script_lines, 
                                                              first_line=block['first_line'], 
                                                              last_line=block['last_line'], 
                                                              scene_id=scene_id, scene_location=scene_location,
                                                              block=block )
                
            elif not block['block_type'] in [ERROR, EMPTY, PAGE_NUM]:
                print "ERROR: Unknown block type, skipping block with type:", block['block_type']


def get_scene_location( scene_heading ):
    '''We try to be forgiving of a variety of styles.  We perform the
    following operations in order:
    1. Remove any leading EXTERIOR, INTERIOR, EXT., or INT.
    2. Remove any leading whitespace and -
    3. Delete all content following the last group of -'s
    4. Remove any training whitespace

    This does bad things if dashes are used in the location name, but
    the time of day of the shot is omitted'''
    
    if ( scene_heading.startswith('INTERIOR') or scene_heading.startswith('EXTERIOR') ):
        scene_heading = scene_heading[8:]
    elif ( scene_heading.startswith('INT.') or scene_heading.startswith('EXT.') ):
        scene_heading = scene_heading[4:]
        
    scene_heading = re.sub( r'^\s*-+\s*', '', scene_heading, count=1 )
    scene_heading = scene_heading.lstrip()

    scene_heading = re.sub( r'-+[^-]*$', '', scene_heading, count=1 )
    scene_heading = scene_heading.rstrip()
    
    scene_heading = strip_leading( scene_heading, 'THE' )

    return scene_heading
    
def get_presence( noun, presence_type, scene_id, page_no, line_no ):
    '''Returns a presence data structure given a noun, scene_id, page
    and line_no'''
    return { 
        'name'  : noun[0],
        'noun_type'  : noun[1],
        'presence_type' : presence_type,
        'where' : {
            'scene_id' : scene_id,
            'page_no'  : page_no,
            'line_no'  : line_no
            }
        };

def update_presence( presence ):
    '''Given a presence data structure updates our global
    representations of the various presences:
    1) Adds to the presences array.

    2) Inserts into the presence_ns hash of hash based on name and
    scene_id, also updates the authoritative noun type found in this
    data structure.
    
    3) Inserts into the presence_sn hash of hash.'''

    presences.append( presence )

    name = presence['name']
    ntype = presence['noun_type']
    scene_id = presence['where']['scene_id']

    if not name in presence_ns:
        presence_ns[name] = { 
            scene_id : [presence],
            'noun_type'     : ntype }
    elif not scene_id in presence_ns[name]:
        presence_ns[name][scene_id] = [presence]
    else:
        presence_ns[name][scene_id].append( presence )

    presence_ns[name]['noun_type'] = update_noun_type( presence_ns[name]['noun_type'], ntype )

    if not scene_id in presence_sn:
        presence_sn[scene_id] = { name : [presence] }
    elif not name in presence_sn[scene_id]:
        presence_sn[scene_id][name] = [presence]
    else:
        presence_sn[scene_id][name].append( presence )

def update_noun_type( old_type, new_type ):
    '''Legal type promotions are THING->CHARACTER and THING->LOCATION,
    and LOCATION->CHARACTER.  Attempts to update CHARACTER or LOCATION
    to THING are ignored.  Attempts to update CHARACTER to LOCATION
    produce errors.'''

    if ( ( old_type == THING and new_type in [ LOCATION, CHARACTER ] ) 
         or ( old_type == LOCATION and new_type == CHARACTER ) ):
        return new_type
    elif old_type == CHARACTER and new_type == LOCATION:
        print "ERROR: detected a character in a location context."
        return old_type
    else:
        return old_type

def update_presence_and_interactions_for_lines( script_lines, first_line, last_line, scene_id, scene_location, presence_type=APPEAR ):
    '''Updates the various global data structures for the block of
    text identified.  Within a block we first detect any nouns defined
    in the block, and then search for any nouns present in the block
    that interact.  Interactions within a block are defined to be when
    two nouns appear in the same sentence.

    Returns an array of the presences detected within this block,
    however the primary purpose is in the side effect of setting the
    presence and interaction of global variables.'''

    result = []

    text = ''.join( [ line['content'] for line in script_lines[first_line-1:last_line] ] )
    # Consolidate non-newline whitespace down to one space.
    text = re.sub( r'[\t ]+', ' ', text )
    # Tuple of ( total_offset, line_no ) pairs that assume a line only
    # has one \n in it.
    line_offsets = get_line_offsets( text, first_line )
    # Update text to have no newlines either.  Now text is our text of
    # interest with only single spaces separating tokens, but
    # line_offsets can be used to tell us which line a given offset is on.
    text = re.sub( r'\s+', ' ', text )

    prior_offset = 0
    for sent in sent_tokenize( text ):
        new_nouns = []

        if mode == FUZZY:
            new_nouns = discover_nouns( sent )
        elif mode == STRICT:
            # In strict mode we only pick up nouns from character
            # dialog and heading lines, not from capitalized stuff in
            # action and dialog blocks.
            pass
        
        # We rely on get_name_offsets sorted on increasing offset
        # below.
        name_offsets = get_name_offsets( sent, prior_offset, new_nouns )

        sent_presences = []

        for name, offset in name_offsets:
            total_offset = prior_offset + offset
            line_no = get_line_for_offset( line_offsets, total_offset )
            presence = get_presence( noun=( name, get_noun_type_for_name( name ) ), 
                                     presence_type=presence_type,
                                     scene_id=scene_id, 
                                     page_no=get_page_for_line( script_lines, line_no ), 
                                     line_no=line_no ) 
            sent_presences.append( presence )
            update_presence( presence )
            result.append( presence )

            update_interaction( scene_location, presence, presence['where'], SETTING )

        for ( p1, p2 ) in itertools.combinations( sent_presences, 2 ):
            update_interaction( p1, p2, p1['where'], APPEAR )

        prior_offset += len( sent )

    return result

def update_presence_and_interactions_for_dialog( script_lines, first_line, last_line, scene_id, scene_location, block ):
    '''Handle the special cases of dialog headers, relationships
    between speakers, and general cases of blocks of dialog.'''

    # For each dialog header, get the name, add a presence, add to list of speakers.
    # For each dialog block, process as a block, then add in interactions for the return values of the block.
    # Add interactions for list of speakers.

    speakers_present = []

    running_dialog = False
    prior_speaker = None
    first_dialog_line = 0
    last_dialog_line = 0

    for line_key in sorted( block['line_types'], key=int ):
        line_no = int( line_key )
        line_type = block['line_types'][line_key]
        
        if line_type == DIALOG_HEADER:
            character = get_character_from_dialog_header( script_lines[ line_no-1  ]['content'] )
            if character == '':
                print "ERROR: Encountered empty character name on line:", line_no
                continue
            speaker = get_presence( ( character, CHARACTER ), DISCUSS,
                                    scene_id, get_page_for_line( script_lines, line_no ), line_no )
            update_presence( speaker )
            update_interaction( scene_location, speaker, speaker['where'], SETTING )
            speakers_present.append( speaker )

            if running_dialog:
                mentioned = update_presence_and_interactions_for_lines( script_lines, first_dialog_line, 
                                                                        last_dialog_line, scene_id, scene_location, MENTION )
                if prior_speaker:
                    for thing in mentioned:
                        update_interaction( prior_speaker, thing, thing['where'], MENTION )
                running_dialog = False

            prior_speaker = speaker

        elif line_type == DIALOG:
            if running_dialog:
                last_dialog_line = line_no
            else:
                running_dialog = True
                first_dialog_line = line_no
                last_dialog_line = line_no

    # Handle the very last bit of dialog.
    if running_dialog:
        mentioned = update_presence_and_interactions_for_lines( script_lines, first_dialog_line, 
                                                                last_dialog_line, scene_id, scene_location, MENTION )
        if prior_speaker:
            for thing in mentioned:
                update_interaction( prior_speaker, thing, thing['where'], MENTION )

    # Each speaker is related to every speaker/dialog entry below them
    # in the dialog, at the point of the first speaker.
    dialog_recorded = {}
    for s1_pos, s1 in enumerate( speakers_present ):
        for s2_pos, s2 in enumerate( speakers_present ):
            if s2_pos <= s1_pos or s2['name'] in dialog_recorded or s1['name'] == s2['name']:
                continue
            update_interaction( s1, s2, s1['where'], DISCUSS )
        dialog_recorded[s1['name']] = True
    
def get_character_from_dialog_header( dialog_header ):
    '''Remove any parentheticals like (V.O.) from the character name.'''
    return re.sub( r'\([^\)]*\)', '', dialog_header ).strip()


def get_line_offsets( text, first_line=0 ):
    '''Return an array of ( total_offset, line_no ) tuples for the input text.'''

    result = []

    total_offset = 0
    for line_no, line in enumerate( text.split( '\n' ) ):
        total_offset += len( line )
        result.append( ( total_offset, first_line + line_no ) )

    # Handle the duplication of the last line due to '' after terminal \n.
    result.pop()

    return result

def discover_nouns( text, ntype=THING ):
    '''Discover as yet undetected nouns in text.  Return array of
    nouns.'''

    provisional_names = []
    
    for name in [ 
        re.sub( r'^(A|I) ', '', x.strip() ) 
        for x in re.findall( r'\b[A-Z][A-Z0-9\s\.\-\']+\b', text ) 
        if ( x.strip() 
             and re.search( r'[A-Z]', x) 
             and x.strip() != 'A' 
             and x.strip() != 'I'
             and x[-1] != "'")
        ]:
        name = strip_leading( name, 'THE' )
        provisional_names.append( name  )

    # Note - I attempted some natural language processing with part of
    # speech tagging here to help double check our assessment -
    # ultimatly it wasn't really helping in weeding the wheat from the
    # chaff in fuzzy mode.

    result = []

    for name in provisional_names:
        if not name in presence_ns:
            result.append( ( name, ntype ) )

    return result

def strip_leading( name, remove ):
    '''Removes the second argument from the beginning of the first if
    and only if there is whitespace after the first argument, and the
    result of stripping does not yeild the empty string or whitespace
    only.'''
    
    result = ''

    if re.match( r'^'+remove+r'\s+', name ):
        result = name[len( remove )+1:]

    if len( result ) == 0:
        return name
    if re.search( r'^\s*$', result ):
        return name

    return result

def get_name_offsets( text, offset=0, new_nouns=[] ):
    '''Given the offset within a text that any nouns occur.  Yields
    both existing nouns defined in presence_ns and any new nouns
    optionally passed in, in order of increasing offset.'''

    result = []

    for name in presence_ns:
        for m in re.finditer( r'\b'+name+r'\b', text, re.I ):
            result.append( ( name, m.start() ) )

    for noun in new_nouns:
        for m in re.finditer( r'\b'+noun[0]+r'\b', text, re.I ):
            result.append( ( noun[0], m.start() ) )
        
    # Handle the odd case where something was present in new_nouns and
    # presence_ns.  Return the list in increasing order of occurrence.
    return sorted( list( set( result ) ), key=lambda x : x[1] )

def get_line_for_offset( line_offsets, pos ):
    '''Return the lowest line number whose end is after pos, or print
    an error and return the first line.'''
    
    for total_offset, line_no in line_offsets:
        if total_offset > pos:
            return line_no

    print "Error: Couldn't find position", pos, " in line offsets:", line_offsets
    return line_offsets[0][1]

def get_noun_type_for_name( name, default=THING ):
    if name in presence_ns:
        return presence_ns[name]['noun_type']
    else:
        return default

def get_page_for_line( script_lines, line_no ):
    return script_lines[line_no-1]['page_no']

def update_interaction( a, b, where, itype ):
    '''Update our three interactions global data structures:
    1. Add the interaction to interactions[]
    2. Add reciprocating interaction to  interaction_ns
    3. Add reciprocating interactions to interaction_sn'''
    
    interactions.append( get_interaction( a, b, where, itype ) )

    _update_interaction_helper( interaction_ns, a, b, where, 'name', 'name', 'scene_id', get_interaction( a, b, where, itype ) )
    _update_interaction_helper( interaction_ns, b, a, where, 'name', 'name', 'scene_id', get_interaction( a, b, where, itype ) )
    _update_interaction_helper( interaction_sn, where, a, b, 'scene_id', 'name', 'name', get_interaction( a, b, where, itype ) )
    _update_interaction_helper( interaction_sn, where, b, a, 'scene_id', 'name', 'name', get_interaction( a, b, where, itype ) )

def _update_interaction_helper( dictionary, a, b, c, a_key, b_key, c_key, interaction ):
    a_val = a[a_key]
    b_val = b[b_key]
    c_val = c[c_key]

    if not a_val in dictionary:
        dictionary[a_val] = { b_val : { c_val : [interaction] } }
    elif not b_val in dictionary[a_val]:
        dictionary[a_val][b_val] = { c_val : [interaction] }
    elif not c_val in dictionary[a_val][b_val]:
        dictionary[a_val][b_val][c_val] = [interaction]
    else:
        dictionary[a_val][b_val][c_val].append( interaction )

def get_interaction( a, b, where, nature ):
    '''Takes in two presences, a where, and a nature and returns an
    interaction.'''

    return { 'a' : a, 'b' : b, 'where' : where, 'interaction_type' : nature }

'''

Issues:

Consider the state diagram for get_types or whatever and see if
there are cases we don't cover.

Rationalize the order of arguments from general to specific or something.

'''
