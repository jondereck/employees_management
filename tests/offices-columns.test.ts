import assert from "node:assert/strict";
import test from "node:test";
import { createElement, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  columns,
  OfficesColumn,
} from "../app/(dashboard)/[departmentId]/(routes)/offices/components/columns";

test("plantillaCount column is sortable with basic numeric sorting", () => {
  const plantillaCountColumn = columns.find(
    (column) => "accessorKey" in column && column.accessorKey === "plantillaCount"
  );

  assert.ok(plantillaCountColumn, "expected a plantillaCount column");
  assert.equal(plantillaCountColumn.enableSorting, true);
  assert.equal(plantillaCountColumn.sortingFn, "basic");
});

test("plantillaCount column displays the Total Plantilla header", () => {
  function HeaderHarness() {
    const table = useReactTable<OfficesColumn>({
      columns,
      data: [],
      getCoreRowModel: getCoreRowModel(),
    });
    const header = table
      .getFlatHeaders()
      .find((candidate) => candidate.column.id === "plantillaCount");

    assert.ok(header, "expected a plantillaCount header");
    const headerRenderer = header.column.columnDef.header;
    if (typeof headerRenderer !== "function") {
      assert.fail("expected plantillaCount header to be a render function");
    }

    const headerElement = headerRenderer(header.getContext());
    assert.ok(isValidElement<{ title?: unknown }>(headerElement));
    assert.equal(headerElement.props.title, "Total Plantilla");

    return null;
  }

  renderToStaticMarkup(createElement(HeaderHarness));
});
