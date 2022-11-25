from django.db import models

# Create your models here.

class Author( models.Model ):
    first_name = models.CharField( max_length=30 )
    last_name = models.CharField( max_length=30 )
    email = models.EmailField()

    def __unicode__( self ):
        return self.first_name + " " + self.last_name

class Script( models.Model ):
    author = models.ForeignKey( Author, on_delete=models.PROTECT )
    title = models.CharField( max_length=100 )
    draft = models.PositiveIntegerField()
    creation_date = models.DateTimeField( auto_now_add=True )
    is_public = models.BooleanField( default=True )
    scenes = models.TextField( blank=True )
    script = models.TextField( blank=True )
    noun_types = models.TextField( blank=True )
    presences = models.TextField( blank=True )
    presence_ns = models.TextField( blank=True )
    presence_sn = models.TextField( blank=True )
    interactions = models.TextField( blank=True )
    interaction_ns = models.TextField( blank=True )
    interaction_sn = models.TextField( blank=True )

    def __unicode__( self ):
        return self.title + " " + self.draft
