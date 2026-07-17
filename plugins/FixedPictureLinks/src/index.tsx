const { findByName, findByProps, findByStoreName } = bunny.metro;
const patcher = bunny.api?.patcher || bunny.metro?.patcher;

const { Pressable } = findByProps("Button", "Text", "View");
const ProfileBanner = findByName("ProfileBanner", false);
const HeaderAvatar = findByName("HeaderAvatar", false);
const GuildIcon = findByName("GuildIcon", false);

const { openMediaModal } = findByProps("openMediaModal");
const { hideActionSheet } = findByProps("hideActionSheet");
const { getChannelId } = findByStoreName("SelectedChannelStore");
const { getGuildId } = findByStoreName("SelectedGuildStore");

let patches: (() => void)[] = [];

// Helper to calculate image dimensions dynamically
function getImageSize(uri: string): Promise<{width: number, height: number}> {
    return new Promise((resolve, reject) => {
        const { Image } = require("react-native"); // Pull native Image safely
        Image.getSize(
            uri,
            (width, height) => resolve({width, height}),
            (error) => reject(error)
        );
    });
}

// Global modal opener
async function openModal(src: string, event) {
    try {
        const { width, height } = await getImageSize(src);
        hideActionSheet?.(); 
        
        openMediaModal({
            initialSources: [{
                uri: src,
                sourceURI: src,
                width,
                height,
                guildId: getGuildId?.(),
                channelId: getChannelId?.(),
            }],
            initialIndex: 0,
            originLayout: {
                width: 0, 
                height: 0,
                x: event.nativeEvent?.pageX || 0,
                y: event.nativeEvent?.pageY || 0,
                resizeMode: "fill",
            }
        });
    } catch (e) {
        console.error("[Profiles] Failed to open asset modal:", e);
    }
}

if (patcher && typeof patcher.after === "function") {

    // 1. CHANNELS / USER AVATARS (Fixed with exact keys from your eval)
    const unpatchAvatar = patcher.after("default", HeaderAvatar, (args, res) => {
        const props = args[0];
        const user = props?.user;
        const style = props?.style;
        const currentGuildId = props?.guildId || getGuildId?.();

        if (!user || !res) return res;

        // Check if a guild-specific avatar exists in the dictionary you found
        const memberAvatarHash = user.guildMemberAvatars?.[currentGuildId];
        let guildSpecificUrl = null;

        if (memberAvatarHash) {
            const ext = memberAvatarHash.startsWith("a_") ? "gif" : "png";
            guildSpecificUrl = `https://cdn.discordapp.com/guilds/${currentGuildId}/users/${user.id}/avatars/${memberAvatarHash}.${ext}?size=4096`;
        }

        // Global Avatar Setup
        let globalUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar?.startsWith("a_") ? "gif" : "png"}?size=4096`;
        
        // Default Avatar Fallback if user has no avatar hash
        if (!user.avatar) {
            globalUrl = `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.id) >> 22n) % 6}.png`;
        }

        delete res.props.style;

        return (
            <Pressable
                onPress={(e) => openModal(guildSpecificUrl || globalUrl, e)}
                onLongPress={(e) => guildSpecificUrl ? openModal(globalUrl, e) : null}
                style={style}>
                {res}
            </Pressable>
        );
    });
    patches.push(unpatchAvatar);

    // 2. PROFILE BANNERS (Preserves animations by checking 'a_')
    const unpatchBanner = patcher.after("default", ProfileBanner, (args, res) => {
        const props = args[0];
        if (!props?.bannerSource?.uri || !res) return res;

        let url = props.bannerSource.uri.replace(/(?:\?size=\d{3,4})?$/, "?size=4096");
        
        // Keep webp animation if it's an animated banner asset, otherwise make it clean png
        if (!url.includes("a_")) {
            url = url.replace(".webp", ".png");
        }

        return <Pressable onPress={(e) => openModal(url, e)}>{res}</Pressable>;
    });
    patches.push(unpatchBanner);

    // 3. GUILD ICONS (Completely decoupled from size gates)
    if (GuildIcon) {
        const unpatchGuildIcon = patcher.after("default", GuildIcon, (args, res) => {
            const props = args[0];
            const guild = props?.guild;
            if (!guild || !guild.icon || !res) return res;

            const ext = guild.icon.startsWith("a_") ? "gif" : "png";
            const url = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=4096`;

            return (
                <Pressable onPress={(e) => openModal(url, e)}>
                    {res}
                </Pressable>
            );
        });
        patches.push(unpatchGuildIcon);
    }
}

export function onUnload() {
    for (const unpatch of patches) {
        if (typeof unpatch === "function") unpatch();
    }
    patches = [];
}
