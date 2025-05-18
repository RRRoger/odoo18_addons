# -*- coding: utf-8 -*-
# Part of Odoo Module Developed by Candidroot Solutions Pvt. Ltd.
# See LICENSE file for full copyright and licensing details.
{
    'name': 'List View Column width Adjustment',
    'version': '18.0.0.1',
    'summary': 'List View Column width Adjustment',
    'author': 'Candidroot Solutions Pvt. Ltd.',
    'description': """
			This module allows user to adjustment of any list view column width.
    """,
    'website': 'www.candidroot.com',
    'depends': ['web'],
    'category': 'Extra Tools',
    'demo': [
    ],
    'assets': {
        'web.assets_backend': [
            '/web_listview_column_width_cr/static/src/js/list_renderer.js',
            '/web_listview_column_width_cr/static/src/scss/main.scss',
        ],
    },
    'images': ['static/description/banner.jpg'],
    'installable': True,
    'live_test_url': 'https://youtu.be/gE5j17aRXG8',
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
