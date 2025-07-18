from setuptools import setup, Extension

setup(
    ext_modules=[
        Extension(
            "nearmiss._core",
            sources=["source/sais.c", "source/tree.c"],
            include_dirs=["source"],
            extra_compile_args=["-fopenmp"],
            extra_link_args=["-fopenmp"],
        )
    ]
)