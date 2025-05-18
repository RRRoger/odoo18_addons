# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
{
    'name' : 'Remove Powered By Odoo',
    'version' : '18.0.0.1',
    'summary': """ 
        Remove powered by odoo, Remove powered by odoo from login page, remove powered by from signup page, remove powered by odoo login screen,
        Hide powered by odoo, odoo powered by hide, odoo powered by remove, disable powered by odoo login screen, Remove Powered by Odoo,Remove Built with Odoo – The #1 Open Source Business App Suite,Remove Odoo: Open Source ERP & eCommerce Platform,Remove Odoo Website Builder – Build Your Site with Ease,Remove Made with ❤ using Odoo,Remove Odoo eCommerce – Modern, Fast, and Open Source
    """,
    'sequence': 10,
    'description': """
        Remove Powered by Odoo from login screen,
        Powered by Odoo - The #1 Open Source eCommerce,
        remove Powered by Odoo - The #1 Open Source eCommerce,
        Remove Powered by Odoo,Remove Built with Odoo – The #1 Open Source Business App Suite,Remove Odoo: Open Source ERP & eCommerce Platform,Remove Odoo Website Builder – Build Your Site with Ease,Remove Made with ❤ using Odoo,Remove Odoo eCommerce – Modern, Fast, and Open Source
    """,
    'category': 'Extra Tools',
    'author': 'A Cloud ERP',
    'website': 'https://www.aclouderp.com',
    'images' : ['static/description/powered_by_odoo.png'],
    'depends' : ['base'],
    'data': [
        'views/web_login.xml',
    ],
    'demo': [
    ],
    'installable': True,
    'application': True,
    'assets': {
        'web._assets_primary_variables': [
        ],
        'web.assets_backend': [

        ],
        'web.assets_frontend': [
        ],
        'web.assets_tests': [
        ],
        'web.qunit_suite_tests': [
        ],
    },
    'license': 'LGPL-3',
}
