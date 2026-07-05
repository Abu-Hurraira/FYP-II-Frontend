import React from "react";
import OutcomeScreen from "./OutcomeScreen.jsx";
import {
  createPLO,
  deletePLO,
  getPLOsByProgram,
  importPLOs,
  restorePLOsByProgram,
  updatePLO,
} from "../../api/plosApi";

const PLOsScreen = () => {
  return (
    <OutcomeScreen
      type="PLO"
      getItems={getPLOsByProgram}
      createItem={createPLO}
      updateItem={updatePLO}
      deleteItem={deletePLO}
      importItems={importPLOs}
      restoreAllByProgram={restorePLOsByProgram}
    />
  );
};

export default PLOsScreen;
