from django.urls import include, path

# Uncomment the next two lines to enable the admin:
# from django.contrib import admin
# admin.autodiscover()

urlpatterns = [ #'',
    # Examples:
    # re_path(r'^$', 'illuminator.views.home', name='home'),
    # re_path(r'^illuminator/', include('illuminator.foo.urls')),

    # Uncomment the admin/doc line below to enable admin documentation:
    # re_path(r'^admin/doc/', include('django.contrib.admindocs.urls')),

    # Uncomment the next line to enable the admin:
    # re_path(r'^admin/', include(admin.site.urls)),
                
                #path( r'', include( 'viz.urls', namespace='viz' ) ),
                path( r'', include( 'viz.urls' ) )
               ]
