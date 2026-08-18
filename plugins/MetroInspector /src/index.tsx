import { metro } from "@vendetta";
import { React } from "@vendetta/react";
import Settings from "./Settings";

// Find Discord UI primitives
const { View, Text, ScrollView, TouchableOpacity, TextInput } = 
  metro.findByProps("ScrollView", "TextInput") || metro.findByProps("View", "Text") || {};

const BottomSheet = metro.findByProps("openLazy", "hideActionSheet") || metro.findByProps("openBottomSheet");

interface ModuleMatch {
  id: string;
  keys: string[];
  exports: any;
}

export function openMetroExplorer(): void {
  if (!BottomSheet?.openLazy) return;

  const modules = metro.modules || (window as any).modules || {};

  BottomSheet.openLazy(
    Promise.resolve({
      default: (props: { close?: () => void }) => {
        const [query, setQuery] = React.useState<string>("");
        const [selectedId, setSelectedId] = React.useState<string | null>(null);

        // Filter modules matching query
        const matches = React.useMemo<ModuleMatch[]>(() => {
          if (!query || query.length < 2) return [];

          const list: ModuleMatch[] = [];
          const q = query.toLowerCase();

          for (const [id, mod] of Object.entries<any>(modules)) {
            if (list.length >= 25) break;

            const exports = mod?.publicModule?.exports || mod?.exports;
            if (!exports) continue;

            try {
              const keys = Object.keys(exports);
              const keysStr = keys.join(", ");

              if (keysStr.toLowerCase().includes(q) || id === query) {
                list.push({ id, keys, exports });
              }
            } catch (e) {}
          }
          return list;
        }, [query]);

        // Detail dump for selected module
        const activeDetail = React.useMemo<string | null>(() => {
          if (!selectedId) return null;
          const mod = modules[selectedId];
          const exp = mod?.publicModule?.exports || mod?.exports;
          if (!exp) return "No exports available";

          try {
            const fullKeys = Object.keys(exp);
            const formatted = fullKeys
              .map((k) => ` • ${k}: <${typeof exp[k]}>`)
              .join("\n");

            return `Module ID: ${selectedId}\nTotal Keys: ${fullKeys.length}\n\nKeys & Types:\n${formatted}`;
          } catch (e: any) {
            return `Error inspecting module: ${e.message}`;
          }
        }, [selectedId]);

        return (
          <View style={{ backgroundColor: "#1e1f22", padding: 18, flex: 1, minHeight: 520 }}>
            {/* Header */}
            <Text style={{ color: "#5865F2", fontSize: 20, fontWeight: "bold", marginBottom: 2 }}>
              ⚡ Metro Explorer
            </Text>
            <Text style={{ color: "#949BA4", fontSize: 12, marginBottom: 10 }}>
              Loaded Modules: {Object.keys(modules).length}
            </Text>

            {/* Search Input */}
            {TextInput && (
              <TextInput
                style={{ backgroundColor: "#2b2d31", color: "#FFFFFF", padding: 10, borderRadius: 8, marginBottom: 10 }}
                placeholder="Search function name or module ID..."
                placeholderTextColor="#949BA4"
                value={query}
                onChangeText={(text: string) => {
                  setQuery(text);
                  setSelectedId(null);
                }}
                autoCapitalize="none"
              />
            )}

            {/* Detail Screen vs List View */}
            {selectedId ? (
              <View style={{ flex: 1, backgroundColor: "#111214", padding: 10, borderRadius: 8, maxHeight: 320 }}>
                <TouchableOpacity
                  style={{ alignSelf: "flex-end", padding: 4, marginBottom: 4 }}
                  onPress={() => setSelectedId(null)}
                >
                  <Text style={{ color: "#5865F2", fontWeight: "bold" }}>← Back to List</Text>
                </TouchableOpacity>
                <ScrollView style={{ flex: 1 }}>
                  <Text selectable style={{ color: "#23a55a", fontFamily: "monospace", fontSize: 11, lineHeight: 16 }}>
                    {activeDetail}
                  </Text>
                </ScrollView>
              </View>
            ) : (
              <ScrollView style={{ flex: 1, backgroundColor: "#2b2d31", padding: 8, borderRadius: 8, maxHeight: 320 }}>
                {matches.length > 0 ? (
                  matches.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={{ paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: "#35363c" }}
                      onPress={() => setSelectedId(item.id)}
                    >
                      <Text style={{ color: "#5865F2", fontWeight: "bold", fontSize: 12 }}>
                        [ID {item.id}]  ({item.keys.length} keys)
                      </Text>
                      <Text
                        selectable
                        numberOfLines={2}
                        style={{ color: "#DBDEE1", fontFamily: "monospace", fontSize: 11, marginTop: 2 }}
                      >
                        {item.keys.join(", ")}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text selectable style={{ color: "#949BA4", fontSize: 12, padding: 8 }}>
                    {query.length < 2 ? "Type at least 2 characters to search exports..." : "No matching modules found."}
                  </Text>
                )}
              </ScrollView>
            )}

            {/* Close Button */}
            <TouchableOpacity
              style={{ backgroundColor: "#da373c", padding: 12, borderRadius: 8, alignItems: "center", marginTop: 12 }}
              onPress={() => {
                if (props?.close) props.close();
                else if (BottomSheet?.hideActionSheet) BottomSheet.hideActionSheet();
              }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "bold" }}>Close Explorer</Text>
            </TouchableOpacity>
          </View>
        );
      }
    }),
    "MetroExplorerSheet"
  );
}

export default {
  onLoad: () => {},
  onUnload: () => {
    if (BottomSheet?.hideActionSheet) {
      BottomSheet.hideActionSheet();
    }
  },
  settings: Settings
};
