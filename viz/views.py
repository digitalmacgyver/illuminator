from django.http import HttpResponse
from django.shortcuts import render, redirect

from viz.models import Author, Script
from viz.forms import UploadForm
#from illuminator.process_script import process_script

def default( request ):
    '''Load the first script in the database by default.'''
    default = Script.objects.order_by('id')[0]
    return redirect( '/vizualize/script/' + str( default.id ) + '/' )

def load_script( request ):
    '''Load a particular script specified in a request query element.'''
    return redirect( '/vizualize/script/' + request.GET['script_id']+'/' )

def illuminator( request, script_id ):
    '''Returns our front end JavaScript for script_id.'''
    return render( request, 'viz/illuminator.js', { 'script_id':script_id } )

def vizualize( request, script_id ):
    '''Render the main page.'''
    script_id = int( script_id )
    scripts = []
    title = 'Select Script From Right to Begin'

    for script in Script.objects.order_by('title', 'draft'):
        scripts.append( { 'title': script.title, 'draft': script.draft, 'script_id': script.id } )
        if script.id == script_id:
            title = script.title
    return render( request, 'viz/illuminate.html', { 'current_id': script_id, 'scripts': scripts, 'title': title } )

def script_data( request, script_id, data_structure ):
    '''Returns JSON for the requested script and data structure, one of:
    scenes - The block types and start/end lines of each block, and line types
    script - An array of the lines, pages, and contents of the script.
    noun_types - A dictionary of noun to noun_type
    presences - An array of all presences
    presence_ns - All presences by noun, scene
    presence_sn - All presences by scene, noun
    interactions - An array of all interactions
    interaction_ns - All interactions by noun a, scene, noun b
    interaction_sn - All interactions by scene, noun a, noun b
    '''
    s = Script.objects.filter( id=int( script_id ) )[0]
    result = ''
    if data_structure == 'scenes':
        result = s.scenes
    elif data_structure == 'script':
        result = s.script
    elif data_structure == 'noun_types':
        result = s.noun_types
    elif data_structure == 'presences':
        result = s.presences
    elif data_structure == 'presence_ns':
        result = s.presence_ns
    elif data_structure == 'presence_sn':
        result = s.presence_sn
    elif data_structure == 'interactions':
        result = s.interactions
    elif data_structure == 'interaction_ns':
        result = s.interaction_ns
    elif data_structure == 'interaction_sn':
        result = s.interaction_sn

    return HttpResponse( result, mimetype="application/json" )

'''
def upload_script( request ):
    if request.method == 'POST':
        form = UploadForm( request.POST, request.FILES )
        if form.is_valid():
            # DEBUG - do a redirect here to another URL than the form
            # so the user can't 'reload' the page and submit a second
            # time.
            title = form.cleaned_data['title']
            draft_number = form.cleaned_data['draft_number']
            script_file = request.FILES['script']

            for filename, filex in request.FILES.iteritems():
                print( request.FILES[filename].name )

            script_id = process_script( script_file, title, draft_number )

            if script_id == -1:
                # Something went wrong processing the file - oops!
                # DEBUG - handle the error.
                pass
            
            return redirect( '/vizualize/script/' + str( script_id ) + '/' )

            # DEBUG - figure out files.
            #script = Script.objects.filter( id=script_id )[0]
            #return render( request, 'viz/upload_script.html', { 'fields': request.POST, 'script':script.noun_types } );
    else:
        form = UploadForm()

    return render( request, 'viz/upload_form.html', { 'form' : form } )
'''
