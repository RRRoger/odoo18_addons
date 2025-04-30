{
    'name': "LLM Tools",
    'version': '1.0',
    'depends': ['base'],
    'author': "Roger",
    'category': 'Tools',
    'description': """
    AI工具集成模块
    """,
    'data': [
        'security/ir.model.access.csv',  # 安全权限文件
        'views/llm_views.xml',
    ],
    'demo': [],
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
