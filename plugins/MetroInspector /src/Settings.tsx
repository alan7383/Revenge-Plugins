import { metro } from "@vendetta";
import { Forms } from "@vendetta/ui/components";
import { openMetroExplorer } from "./index";

// Fallback to window.React or find React directly in Metro
const React = (window as any).React || metro.findByProps("createElement", "useState");
const { FormButton, FormSection, FormText } = Forms;

export default function Settings(): React.JSX.Element {
  return (
    <FormSection title="Metro Explorer Controls">
      <FormText style={{ marginBottom: 12, color: "#949BA4" }}>
        Launch the interactive Metro inspector bottom sheet to search, copy, and inspect active memory modules.
      </FormText>
      <FormButton
        label="Open Metro Explorer"
        onPress={() => openMetroExplorer()}
      />
    </FormSection>
  );
}
