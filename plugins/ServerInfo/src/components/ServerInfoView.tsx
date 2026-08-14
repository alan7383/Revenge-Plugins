import { React, ReactNative as RN } from "@vendetta/metro/common";
import { findByProps, findByStoreName, findByName } from "@vendetta/metro";
import { rawColors, semanticColors } from "@vendetta/ui";

// UI & ActionSheet Setup
const ActionSheet = findByProps("ActionSheet")?.ActionSheet ?? RN.View;
const ASCBMod = findByProps("ActionSheetCloseButton");
const ActionSheetCloseButton = ASCBMod?.ActionSheetCloseButton;
const { hideActionSheet } = findByProps("openLazy", "hideActionSheet") ?? {};

// Table UI components
const TableRow = findByProps("TableRow")?.TableRow ?? findByProps("FormRow")?.FormRow;
const TableRowGroup = findByProps("TableRowGroup")?.TableRowGroup ?? findByProps("FormSection")?.FormSection;

// Core Stores
const Dispatcher = findByProps("dispatch", "subscribe");
const GuildStore = findByStoreName("GuildStore");
const GuildMemberStore = findByStoreName("GuildMemberStore");
const UserStore = findByStoreName("UserStore");
const ThemeStore = findByStoreName("ThemeStore");
const GuildRoleStore = findByStoreName("GuildRoleStore");
const GuildChannelStore = findByStoreName("GuildChannelStore");
const MemberCountStore = findByProps("getMemberCount", "getOnlineCount");
const HeaderCountsStore = findByStoreName("GuildHeaderCountsStore") ?? MemberCountStore;

// Network & API Modules
const RestAPI = findByProps("get", "post", "del", "patch");
const UserFetchModule = findByProps("fetchProfile", "getUser") ?? findByProps("fetchProfile");
const showUserProfile = 
    findByName("showUserProfileActionSheet", false) 
    ?? findByProps("openUserProfileModal")?.openUserProfileModal 
    ?? findByProps("showUserProfile")?.showUserProfile 
    ?? findByProps("openUserProfile")?.openUserProfile;

const TextStyleSheet = findByProps("TextStyleSheet")?.TextStyleSheet;
const colorModule = findByProps("colors", "unsafe_rawColors");
const colorResolver = colorModule?.internal ?? colorModule?.meta;

// --- IN-MEMORY GUILD OWNER CACHE ---
const ownerCache = new Map<string, { id: string; name: string; avatar: string | null }>();

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

function FallbackRow({ label, subLabel, icon, onPress }: any) {
    return (
        <RN.TouchableOpacity
            onPress={onPress}
            disabled={!onPress}
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderBottomWidth: 0.5,
                borderBottomColor: sc("background-modifier-accent"),
            }}
        >
            {icon && <RN.View style={{ marginRight: 12 }}>{icon}</RN.View>}
            <RN.View style={{ flex: 1 }}>
                <T variant="text-md/semibold">{label}</T>
                {subLabel && (
                    <T variant="text-sm/medium" style={{ color: sc("text-muted"), marginTop: 2 }}>
                        {subLabel}
                    </T>
                )}
            </RN.View>
        </RN.TouchableOpacity>
    );
}

export default function ServerInfoView({ guildId }: { guildId: string }) {
    const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

    // Live store subscriptions
    React.useEffect(() => {
        const stores = [
            GuildStore,
            UserStore,
            GuildRoleStore,
            GuildChannelStore,
            MemberCountStore,
            HeaderCountsStore,
        ].filter(Boolean);

        for (const store of stores) {
            store?.addChangeListener?.(forceUpdate);
        }
        return () => {
            for (const store of stores) {
                store?.removeChangeListener?.(forceUpdate);
            }
        };
    }, []);

    const guild = GuildStore?.getGuild?.(guildId);
    
    // Cached owner state
    const cachedOwner = ownerCache.get(guildId);
    const [ownerId, setOwnerId] = React.useState<string | null>(guild?.ownerId ?? cachedOwner?.id ?? null);
    const [ownerName, setOwnerName] = React.useState<string | null>(cachedOwner?.name ?? null);
    const [ownerAvatarHash, setOwnerAvatarHash] = React.useState<string | null>(cachedOwner?.avatar ?? null);

    // Fetch Guild Owner ID if missing
    React.useEffect(() => {
        if (ownerId || !RestAPI?.get) return;
        let cancelled = false;

        RestAPI.get({ url: `/guilds/${guildId}` })
            .then((res: any) => {
                if (!cancelled && res?.body?.owner_id) {
                    setOwnerId(res.body.owner_id);
                }
            })
            .catch(() => {});

        return () => { cancelled = true; };
    }, [guildId, ownerId]);

    // Fetch Owner User Profile and Cache Result
    React.useEffect(() => {
        if (!ownerId) return;

        // Check if user exists in standard UserStore
        const storeUser = UserStore?.getUser?.(ownerId);
        if (storeUser?.username) {
            const name = storeUser.globalName ?? storeUser.username;
            setOwnerName(name);
            if (storeUser.avatar) setOwnerAvatarHash(storeUser.avatar);
            ownerCache.set(guildId, { id: ownerId, name, avatar: storeUser.avatar ?? null });
            return;
        }

        let cancelled = false;

        const handleUserData = (userData: any) => {
            if (!userData || cancelled) return;
            const name = userData.global_name ?? userData.globalName ?? userData.username;
            const avatar = userData.avatar ?? null;

            // Dispatch into Discord core store so it stays cached globally
            Dispatcher?.dispatch({
                type: "USER_UPDATE",
                user: userData,
            });

            setOwnerName(name);
            setOwnerAvatarHash(avatar);
            ownerCache.set(guildId, { id: ownerId, name, avatar });
        };

        if (UserFetchModule?.fetchProfile) {
            UserFetchModule.fetchProfile(ownerId, { guildId })
                .then((res: any) => handleUserData(res?.user))
                .catch(() => {});
        } else if (RestAPI?.get) {
            RestAPI.get({ url: `/users/${ownerId}` })
                .then((res: any) => handleUserData(res?.body))
                .catch(() => {});
        }

        return () => { cancelled = true; };
    }, [ownerId, guildId]);

    if (!guild) return null;

    // Direct CDN Asset URL Construction
    const iconUrl = guild.icon 
        ? `https://cdn.discordapp.com/icons/${guildId}/${guild.icon}.${guild.icon.startsWith("a_") ? "gif" : "png"}?size=256` 
        : null;

    const bannerUrl = guild.banner 
        ? `https://cdn.discordapp.com/banners/${guildId}/${guild.banner}.${guild.banner.startsWith("a_") ? "gif" : "png"}?size=512` 
        : null;

    const bio = guild.description ?? null;

    // Member & Guild Metrics
    const rawMemberCount = 
        MemberCountStore?.getMemberCount?.(guildId) 
        ?? guild.memberCount 
        ?? guild.approximateMemberCount 
        ?? GuildMemberStore?.getMemberIds?.(guildId)?.length;

    const memberCount = typeof rawMemberCount === "number" ? rawMemberCount.toLocaleString() : (rawMemberCount ?? "—");
    const rawOnlineCount = HeaderCountsStore?.getOnlineCount?.(guildId) ?? MemberCountStore?.getOnlineCount?.(guildId);
    const onlineCount = typeof rawOnlineCount === "number" ? rawOnlineCount.toLocaleString() : null;

    const roleCount = GuildRoleStore?.getSortedRoles?.(guildId)?.length ?? null;
    const channelCount = GuildChannelStore?.getChannels ? Object.keys(GuildChannelStore.getChannels(guildId) ?? {}).length : null;

    // Owner Avatar
    const ownerMember = ownerId ? GuildMemberStore?.getMember?.(guildId, ownerId) : null;
    const finalOwnerName = ownerMember?.nick ?? ownerName ?? (ownerId ? `User (${ownerId.slice(0, 6)})` : "Unknown");

    const avatarExt = ownerAvatarHash?.startsWith("a_") ? "gif" : "png";
    const ownerAvatarUri = ownerAvatarHash
        ? `https://cdn.discordapp.com/avatars/${ownerId}/${ownerAvatarHash}.${avatarExt}?size=64`
        : (ownerId ? `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(ownerId) >> 22n) % 6n)}.png` : null);

    const boostLevel = guild.premiumTier ?? 0;
    const boostCount = guild.premiumSubscriberCount ?? 0;
    const vanityCode = guild.vanityURLCode ? `discord.gg/${guild.vanityURLCode}` : null;

    const createdDate = new Date(
        Number((BigInt(guildId) >> 22n) + 1420070400000n)
    ).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

    const handleOwnerPress = () => {
        if (!ownerId) return;
        hideActionSheet?.();
        showUserProfile?.({ userId: ownerId, guildId });
    };

    const RowComponent = TableRow || FallbackRow;
    const GroupContainer = TableRowGroup || RN.View;

    return (
        <ActionSheet>
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
                {/* Banner & Icon Section */}
                <RN.View style={{ alignItems: "center", marginBottom: 16 }}>
                    <RN.View style={{ width: "100%", height: 100, backgroundColor: sc("background-tertiary") }}>
                        {bannerUrl && (
                            <RN.Image
                                source={{ uri: bannerUrl }}
                                style={{ width: "100%", height: "100%", resizeMode: "cover" }}
                            />
                        )}
                    </RN.View>

                    <RN.View style={{ marginTop: -35, alignItems: "center", paddingHorizontal: 16 }}>
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
                        
                        {/* Server Bio / Description */}
                        {bio && (
                            <T variant="text-sm/medium" style={{ color: sc("text-muted"), textAlign: "center", marginTop: 4 }}>
                                {bio}
                            </T>
                        )}
                    </RN.View>
                </RN.View>

                {/* OVERVIEW SECTION */}
                <RN.View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                    <GroupContainer title="OVERVIEW">
                        <RowComponent label="Members" subLabel={String(memberCount)} />
                        {onlineCount && <RowComponent label="Online" subLabel={String(onlineCount)} />}
                        {roleCount !== null && <RowComponent label="Roles" subLabel={String(roleCount)} />}
                        {channelCount !== null && <RowComponent label="Channels" subLabel={String(channelCount)} />}
                        <RowComponent label="Boost Status" subLabel={`Level ${boostLevel} (${boostCount} Boosts)`} />
                    </GroupContainer>
                </RN.View>

                {/* SERVER DETAILS SECTION */}
                <RN.View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
                    <GroupContainer title="SERVER DETAILS">
                        {ownerId && (
                            <RowComponent
                                label="Owner"
                                subLabel={finalOwnerName}
                                icon={
                                    ownerAvatarUri ? (
                                        <RN.Image
                                            source={{ uri: ownerAvatarUri }}
                                            style={{ width: 24, height: 24, borderRadius: 12 }}
                                        />
                                    ) : undefined
                                }
                                onPress={handleOwnerPress}
                                arrow
                            />
                        )}
                        {vanityCode && <RowComponent label="Vanity URL" subLabel={vanityCode} />}
                        <RowComponent label="Created On" subLabel={createdDate} />
                        <RowComponent label="Server ID" subLabel={guildId} />
                    </GroupContainer>
                </RN.View>
            </RN.ScrollView>
        </ActionSheet>
    );
}
