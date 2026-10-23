import { ScrollView, Text, View } from "react-native";
import { Section } from "./parts";
import type { PanelUi } from "./types";

// Static on purpose: Help should explain the model without reading, changing, or implying anything about this store.
export function MemoryHelp({ ui }: { ui: PanelUi }) {
  const { styles } = ui;
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.stack}>
        <Text style={styles.heading}>How Memory works</Text>
        <Text style={styles.paragraph}>
          Memory is a small shared notebook for useful context. It helps people and agents find the right note later.
        </Text>
      </View>

      <Section styles={styles} title="Memories and instructions">
        <Text style={styles.text}>A memory can be a preference, project knowledge, or a correction.</Text>
        <Text style={styles.text}>
          An instruction is a memory marked Required. It is an explicit rule to check before acting when it applies.
        </Text>
        <Text style={styles.muted}>
          Required is separate from the memory kind. A correction is not automatically an instruction.
        </Text>
      </Section>

      <Section styles={styles} title="Who saves and reviews memories">
        <Text style={styles.text}>Agents save useful, durable memories automatically. They do not ask first.</Text>
        <Text style={styles.text}>
          Agent observations and inferences are marked Observed or Inferred and are not Required. Required is reserved
          for an explicit instruction from a person.
        </Text>
        <Text style={styles.text}>
          People can review any memory here. To remove one from current search and Instructions, choose Remove from
          recall. Its record and history stay in the store. Already attached copies are unchanged. Existing agent cached
          text cannot be recalled.
        </Text>
        <Text style={styles.muted}>Each memory shows who asserted it and how, so a reviewer can judge it.</Text>
      </Section>

      <Section styles={styles} title="When a memory applies">
        <Text style={styles.text}>
          Each memory says where it applies, such as this directory or everywhere on this host. It can also have a start or end time.
        </Text>
        <Text style={styles.text}>
          Search and Instructions show records that match the current workspace, time, and status. History is shown separately.
        </Text>
      </Section>

      <Section styles={styles} title="Search and explore">
        <Text style={styles.text}>
          Search finds words in memory titles and text. A short start of a word also matches longer words, such as “arch” finding “architecture.”
        </Text>
        <Text style={styles.text}>
          Open a result to see where it is filed, who it is about, its scope, source, and replacement history. Explore connections follows those named links.
        </Text>
        <Text style={styles.muted}>
          A connection helps you browse. It does not make a memory applicable or authoritative by itself.
        </Text>
      </Section>

      <Section styles={styles} title="What is stored">
        <Text style={styles.text}>
          A memory has a title and body, a kind, a scope, and a status. It may also have a source, a filing topic, a subject, or a link to an older version.
        </Text>
        <Text style={styles.text}>
          The graph stores those relationships. A separate search index makes titles and bodies quick to find.
        </Text>
      </Section>

      <Section styles={styles} title="What Memory does not do">
        <Text style={styles.text}>
          Saving a memory does not prove it is true, open its source, or make an agent obey it automatically.
        </Text>
        <Text style={styles.text}>
          Attached memories are snapshots sent only when you add them to a composer. Sending a message remains a separate action.
        </Text>
        <Text style={styles.muted}>
          A person’s current instruction always takes priority over stored memory.
        </Text>
      </Section>
    </ScrollView>
  );
}
