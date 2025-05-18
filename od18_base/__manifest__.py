# -*- coding: utf-8 -*-
{
    'license': 'LGPL-3',
    'name': "Odoo 18 Base",
    'summary': "Odoo 18 Base",
    'author': "roger <i@roger.me>",
    'website': "https://roger.me",
    'support': 'i@roger.me',
    'category': 'Extra Tools',
    'version': '1.0',
    'depends': ['base_setup'],
    'demo': [
        'data/demo.xml',
    ],
    'data': [
        'views/res_config.xml',
    ],
    'images': [
        'static/description/main_screenshot.png',
    ],
    'assets': {
        'web.assets_backend': [
            'web_window_title/static/src/js/web_window_title.js',
        ],
    },
    'installable': True,
    'auto_install': False,
    'application': False,
}