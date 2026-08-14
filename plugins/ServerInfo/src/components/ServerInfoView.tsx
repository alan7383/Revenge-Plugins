import { React, ReactNative as RN } from "@vendetta/metro/common";
import { findByProps, findByStoreName, findByName } from "@vendetta/metro";
import { rawColors, semanticColors } from "@vendetta/ui";
import { TableRow, TableRowGroup } from "@vendetta/ui/components";

const ActionSheet = findByProps("ActionSheet")?.ActionSheet;
const ASCBMod = findByProps("ActionSheetCloseButton");
const ActionSheetCloseButton = ASCBMod?.ActionSheetCloseButton;
const { hideActionSheet } = findByProps("openLazy", "hideActionSheet") ?? {};

// Stores & Actions
const GuildStore = findByStoreName("GuildStore");
const GuildMemberStore = findByStoreName("GuildMemberStore");
const UserStore = findByStoreName("UserStore");
const ThemeStore = findByStoreName("ThemeStore");

const showUserProfile = findByName("showUserProfileActionSheet") 
    ?? findByProps("openUserProfileModal")?.openUserProfileModal 
    ?? findByProps("showUserProfile")?.showUserProfile 
    ?? findByProps("openUserProfile")?.openUserProfile;

const TextStyleSheet = findByProps("TextStyleSheet")?.TextStyleSheet;
const colorModule = findByProps("colors", "unsafe_rawColors");
const colorResolver = colorModule?.internal ?? colorModule?.meta;

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

    // Fetch accurate member count
    const memberCount = guild.memberCount 
        ?? GuildMemberStore?.getMemberIds?.(guildId)?.length 
        ?? "Unknown";

    // Fetch Owner Details
    const ownerId = guild.ownerId;
    const ownerMember = ownerId ? GuildMemberStore?.getMember?.(guildId, ownerId) : null;
    const ownerUser = ownerId ? UserStore?.getUser?.(ownerId) : null;

    const ownerName = ownerMember?.nick 
        ?? ownerUser?.globalName 
        ?? ownerUser?.username 
        ?? (ownerId ? `User (${ownerId.slice(0, 6)})` : "Unknown");

    const ownerAvatar = ownerUser?.getAvatarURL?.(true, 64) 
        ?? (ownerId ? `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(ownerId) >> 22n) % 6n)}.png` : null);

    // Images
    const iconUrl = guild.getIconURL?.() ?? null;
    const bannerUrl = guild.getBannerURL?.() ?? null;

    // Creation Date
    const createdDate = new Date(
        Number(BigInt(guildId) >> 22n) + 1420070400000
    ).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

    const handleOwnerPress = () => {
        if (!ownerId) return;
        hideActionSheet?.();
        showUserProfile?.({ userId: ownerId });
    };

    return (
        <ActionSheet>
            {/* Header / Navigation bar */}
            <RN.View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16 }}>
                <T variant="heading-md/bold" style={{ flex: 1 }}>Server Information</T>
                {ActionSheetCloseButton ? (
                    <ActionSheetCloseButton onPress={() => hideActionSheet?.()} />
                ) : (
                    <T variant="text-md/semibold" style={{ color: rawColors.BRAND_500 }} onPress={() => hideActionSheet?.()}>
                        Close
                    </T>
                )}
            </RN.View>

            <RN.ScrollView style={{ flex: 1 }}>
                {/* Banner & Icon Header Visual */}
                <RN.View style={{ alignItems: "center", marginBottom: 16 }}>
                    <RN.View style={{ width: "100%", height: 100, backgroundColor: sc("background-tertiary") }}>
                        {bannerUrl && (
                            <RN.Image
                                source={{ uri: bannerUrl }}
                                style={{ width: "100%", height: "100%", resizeMode: "cover" }}
                            />
                        )}
                    </RN.View>

                    <RN.View style={{ marginTop: -35, alignItems: "center" }}>
                        {iconUrl ? (
                            <RN.Image
                                source={{ uri: iconUrl }}
                                style={{
                                    width: 70,
                                    height: 70,
                                    borderRadius: 35,
                                    borderWidth: 3,
                                    borderColor: sc("background-floating"),
                                }}
                            />
                        ) : (
                            <RN.View
                                style={{
                                    width: 70,
                                    height: 70,
                                    borderRadius: 35,
                                    borderWidth: 3,
                                    borderColor: sc("background-floating"),
                                    backgroundColor: sc("background-accent"),
                                    justifyContent: "center",
                                    alignItems: "center",
                                }}
                            >
                                <T variant="heading-lg/bold">{guild.name?.slice(0, 2)}</T>
                            </RN.View>
                        )}
                        <T variant="heading-lg/bold" style={{ marginTop: 8, textAlign: "center" }}>
                            {guild.name}
                        </T>
                    </RN.View>
                </RN.View>

                {/* Information Sections via TableRows */}
                <RN.View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
                    <TableRowGroup title="SERVER OVERVIEW">
                        {ownerId && (
                            <TableRow
                                label="Owner"
                                subLabel={ownerName}
                                icon={
                                    ownerAvatar ? (
                                        <RN.Image
                                            source={{ uri: ownerAvatar }}
                                            style={{ width: 24, height: 24, borderRadius: 12 }}
                                        />
                                    ) : undefined
                                }
                                onPress={handleOwnerPress}
                                arrow
                            />
                        )}
                        <TableRow
                            label="Members"
                            subLabel={String(memberCount)}
                        />
                        <TableRow
                            label="Created On"
                            subLabel={createdDate}
                        />
                        <TableRow
                            label="Server ID"
                            subLabel={guildId}
                        />
                    </TableRowGroup>
                </RN.View>
            </RN.ScrollView>
        </ActionSheet>
    );
}
