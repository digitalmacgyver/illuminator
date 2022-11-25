from django.urls import path, re_path
from django.conf import settings

from viz import views

urlpatterns = [ #'',
                re_path( r'^illuminator/(?P<script_id>[\d]+)/illuminator\.js$', views.illuminator, name='illuminator' ),
                re_path( r'^script_data/(?P<script_id>[\d]+)/(?P<data_structure>[\w]+)/$', views.script_data, name='script_data' ),
                re_path( r'^vizualize/script/(?P<script_id>[\d]+)/', views.vizualize, name='vizualize' ),
                re_path( r'^load_script', views.load_script, name='load_script' ),
                #url( r'^upload_script/', views.upload_script, name='upload_script' ),
                path( r'', views.default, name='default' ),
                #                        url( r'^static/(?P<path>.*)$', 'django.views.static.serve', {'document_root': settings.STATIC_ROOT}),
               ]
