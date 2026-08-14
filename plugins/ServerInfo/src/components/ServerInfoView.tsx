import { React, ReactNative as RN } from "@vendetta/metro/common";
import { findByProps, findByStoreName } from "@vendetta/metro";
import { rawColors, semanticColors } from "@vendetta/ui";

const ActionSheet = findByProps("ActionSheet")?.ActionSheet;
const ASCBMod = findByProps("ActionSheetCloseButton");
const ActionSheetCloseButton = ASCBMod?.ActionSheetCloseButton;
const { hideActionSheet } = findByProps("openLazy", "hideActionSheet") ?? {};

const TextStyleSheet = findByProps("TextStyleSheet")?.TextStyleSheet;
const colorModule = findByProps("colors", "unsafe_rawColors");
const colorResolver = colorModule?.internal ?? colorModule?.meta;
const ThemeStore = findByStoreName("ThemeStore");
const GuildStore = findByStoreName("GuildStore");

function sc(key: string): string {
    const t = ThemeStore?.theme ?? "dark";
    const uk = key.replace(/-/g, "_").toUpperCase();
    const sym = (semanticColors as any)?.[key] ?? (semanticColors as any)?.[uk];
    if (!sym) return "#DBDCDD";
    const resolved = colorResolver?.resolveSemanticColor(t, sym);
    return typeof resolved === "string" ? resolved : "#DBDCDD";
}

function T(p: any) {
    const { style, variant, ...rest } = p;
    return (
        <RN.Text
            style={[
                variant && TextStyleSheet?.[variant as keyof typeof TextStyleSheet],
                style?.color ? {} : { color: sc("text-default") },
                style,
            ]}
            {...rest}
        />
    );
}

export default function ServerInfoView({ guildId }: { guildId: string }) {
    const guild = GuildStore?.getGuild?.(guildId);
    if (!guild) return null;

    const memberCount = guild.memberCount ?? "Unknown";
    const ownerId = guild.ownerId ?? "Unknown";
    const createdDate = new Date(
        Number(BigInt(guildId) >> 22n) + 1420070400000
    ).toLocaleDateString();

    const iconUrl = guild.getIconURL?.() ?? null;

    return (
        <ActionSheet>
            <RN.View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16 }}>
                {iconUrl && (
                    <RN.Image
                        source={{ uri: iconUrl }}
                        style={{ width: 28, height: 28, borderRadius: 14, marginRight: 10 }}
                    />
                )}
                <T variant="heading-md/semibold" style={{ flex: 1 }}>{guild.name}</T>
                {ActionSheetCloseButton
                    ? <ActionSheetCloseButton onPress={() => { hideActionSheet?.(); }} />
                    : <T variant="text-md/semibold" style={{ color: rawColors.BRAND_500 }} onPress={() => { hideActionSheet?.(); }}>Close</T>}
            </RN.View>

            <RN.ScrollView style={{ flex: 1, padding: 16 }}>
                <RN.View style={{ paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: sc("background-modifier-accent") }}>
                    <T variant="text-xs/bold" style={{ color: sc("text-muted"), textTransform: "uppercase" }}>Server ID</T>
                    <T variant="text-md/medium" style={{ marginTop: 2 }}>{guildId}</T>
                </RN.View>

                <RN.View style={{ paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: sc("background-modifier-accent") }}>
                    <T variant="text-xs/bold" style={{ color: sc("text-muted"), textTransform: "uppercase" }}>Members</T>
                    <T variant="text-md/medium" style={{ marginTop: 2 }}>{memberCount}</T>
                </RN.View>

                <RN.View style={{ paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: sc("background-modifier-accent") }}>
                    <T variant="text-xs/bold" style={{ color: sc("text-muted"), textTransform: "uppercase" }}>Created On</T>
                    <T variant="text-md/medium" style={{ marginTop: 2 }}>{createdDate}</T>
                </RN.View>

                <RN.View style={{ paddingVertical: 10 }}>
                    <T variant="text-xs/bold" style={{ color: sc("text-muted"), textTransform: "uppercase" }}>Owner ID</T>
                    <T variant="text-md/medium" style={{ marginTop: 2 }}>{ownerId}</T>
                </RN.View>
            </RN.ScrollView>
        </ActionSheet>
    );
}
