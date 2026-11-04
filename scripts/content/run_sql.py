"""Ejecuta un archivo SQL en SQLite e imprime las filas de cada consulta.

Cada fila ocupa una línea y sus columnas se separan con "|". NULL se imprime como NULL.
"""

import sqlite3
import sys


def main(path):
    with open(path, encoding="utf-8") as file:
        lines = file.read().splitlines(keepends=True)

    # Sin transacciones implícitas de Python, para que BEGIN y ROLLBACK funcionen como se escriben.
    connection = sqlite3.connect(":memory:", isolation_level=None)
    statement = ""
    for line in lines:
        statement += line
        if not sqlite3.complete_statement(statement):
            continue
        cursor = connection.execute(statement)
        statement = ""
        if cursor.description is None:
            continue
        for row in cursor.fetchall():
            print("|".join("NULL" if value is None else str(value) for value in row))

    if statement.strip():
        raise ValueError("el fragmento termina con una sentencia incompleta")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", newline="\n")
    main(sys.argv[1])
