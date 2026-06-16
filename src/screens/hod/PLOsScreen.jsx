import React from "react";
import OutcomeScreen from "./OutcomeScreen.jsx";
import {
  createPLO,
  deletePLO,
  getPLOsByProgram,
  importPLOs,
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
    />
  );
};

export default PLOsScreen;
