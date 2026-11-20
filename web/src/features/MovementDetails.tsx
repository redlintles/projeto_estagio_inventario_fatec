import React from "react";
import * as A from "../api";
import {
  describeChanges,
  describeNotes,
  HistoryContext,
  operationLabel,
} from "../history";

/** Título, data, observação e campos alterados de um registro do histórico. */
export function MovementDetails({
  movement,
  context,
}: {
  movement: A.Movement;
  context: HistoryContext;
}) {
  const notes = describeNotes(movement.notes, context);
  const changes = describeChanges(movement, context);
  const created = !movement.before;
  return (
    <>
      {notes && <p>{notes}</p>}
      {changes.length > 0 && (
        <details>
          <summary>{created ? "Dados registrados" : "O que mudou"}</summary>
          <table className="history-changes">
            <thead>
              <tr>
                <th>Campo</th>
                {!created && <th>Antes</th>}
                <th>{created ? "Valor" : "Depois"}</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.label}>
                  <td>{c.label}</td>
                  {!created && <td>{c.before}</td>}
                  <td>{c.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </>
  );
}

export { operationLabel };
