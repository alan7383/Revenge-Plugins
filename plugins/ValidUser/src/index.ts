import { findByProps } from "@vendetta/metro";
import { before, after } from "@vendetta/patcher";
import { logger } from "@vendetta";
import { React } from "@vendetta/metro/common";
import { findInReactTree } from "@vendetta/utils";
import { getAssetIDByName } from "@vendetta/ui/assets";

const ActionSheet = findByProps("openLazy", "hideActionSheet");
const { ActionSheetRow } = findByProps("ActionSheetRow");

const MentionIcon =
    getAssetIDByName("ic_mention_24px") ??
    getAssetIDByName("MentionIcon") ??
    getAssetIDByName("mention");

const sleep = (ms: number) =>
    new Promise(resolve => setTimeout(resolve, ms));

function extractIdsFromText(text: string): string[] {
    if (!text) return [];

    return [
        ...text.matchAll(/<@!?(\d{17,19})>/g)
    ].map(x => x[1]);
}

function extractAllMentionIds(message: any): string[] {
    const ids: string[] = [];

    if (message.content) {
        ids.push(...extractIdsFromText(message.content));
    }

    if (message.embeds && Array.isArray(message.embeds)) {
        for (const embed of message.embeds) {
            if (embed.rawTitle) {
                ids.push(...extractIdsFromText(embed.rawTitle));
            }

            if (embed.rawDescription) {
                ids.push(...extractIdsFromText(embed.rawDescription));
            }

            if (embed.fields && Array.isArray(embed.fields)) {
                for (const field of embed.fields) {
                    if (field.name) {
                        ids.push(...extractIdsFromText(field.name));
                    }

                    if (field.value) {
                        ids.push(...extractIdsFromText(field.value));
                    }
                }
            }
        }
    }

    return [...new Set(ids)];
}

function isUserCached(userId: string): boolean {
    const UserStore = findByProps(
        "getUser",
        "getCurrentUser"
    );

    return !!UserStore?.getUser?.(userId);
}

async function forceUIRefresh(
    channelId: string,
    messageId: string,
    content: string,
    embeds: any[] = []
) {
    const Dispatcher = findByProps(
        "dispatch",
        "subscribe"
    );

    const freshContent = content
        ? content + " "
        : " ";

    Dispatcher.dispatch({
        type: "MESSAGE_UPDATE",
        message: {
            id: messageId,
            channel_id: channelId,
            content: freshContent,
            embeds
        }
    });

    await sleep(50);

    Dispatcher.dispatch({
        type: "MESSAGE_UPDATE",
        message: {
            id: messageId,
            channel_id: channelId,
            content,
            embeds
        }
    });
}

async function fetchUsersViaGateway(
    userIds: string[]
): Promise<boolean> {
    const GatewayConnection = findByProps(
        "getGateway",
        "send"
    );

    const SelectedGuildStore = findByProps(
        "getGuildId",
        "getChannelId"
    );

    const currentGuildId =
        SelectedGuildStore?.getGuildId?.();

    if (!currentGuildId) return false;

    const ws =
        GatewayConnection?.getGateway?.();

    if (!ws) return false;

    ws.send(8, {
        guild_id: currentGuildId,
        user_ids: userIds,
        presences: false
    });

    await sleep(400);

    return true;
}

async function fetchUser(userId: string) {
    const Dispatcher = findByProps(
        "dispatch",
        "subscribe"
    );

    const RestAPI = findByProps(
        "get",
        "post",
        "del",
        "patch"
    );

    const response = await RestAPI.get({
        url: `/users/${userId}`
    });

    if (response.body) {
        Dispatcher.dispatch({
            type: "USER_UPDATE",
            user: response.body
        });

        return response.body.username;
    }

    throw new Error(
        "Empty API response body"
    );
}

async function fixUnknownMentions(message: any) {
    const ids =
        extractAllMentionIds(message);

    const channelId =
        message.channel_id;

    const messageId =
        message.id;

    if (ids.length === 0) return;

    const uncachedIds: string[] = [];

    for (const userId of ids) {
        if (!isUserCached(userId)) {
            uncachedIds.push(userId);
        }
    }

    if (uncachedIds.length === 0) {
        /*
         * Only refresh normal messages.
         * Embed-only messages can lose their embed content
         * when manually dispatched as MESSAGE_UPDATE.
         */
        if (
            channelId &&
            messageId &&
            message.content
        ) {
            await forceUIRefresh(
                channelId,
                messageId,
                message.content,
                message.embeds
            );
        }

        return;
    }

    const BULK_THRESHOLD = 5;

    let success = false;

    const SelectedGuildStore = findByProps(
        "getGuildId"
    );

    if (
        uncachedIds.length > BULK_THRESHOLD &&
        SelectedGuildStore?.getGuildId?.()
    ) {
        success =
            await fetchUsersViaGateway(
                uncachedIds
            );
    }

    if (!success) {
        const safetyDelay =
            uncachedIds.length > 10
                ? 450
                : 250;

        for (
            let i = 0;
            i < uncachedIds.length;
            i++
        ) {
            const userId =
                uncachedIds[i];

            try {
                await fetchUser(userId);
            } catch (err) {
                logger.error(
                    `[ValidUser] Fetch Failed for ${userId}:`,
                    err
                );
            }

            if (
                i <
                uncachedIds.length - 1
            ) {
                await sleep(
                    safetyDelay
                );
            }
        }
    }

    /*
     * Do not force a MESSAGE_UPDATE on embed-only messages.
     * Discord can replace/remove the embed when the partial
     * message update does not contain the complete embed state.
     */
    if (
        channelId &&
        messageId &&
        message.content
    ) {
        await forceUIRefresh(
            channelId,
            messageId,
            message.content,
            message.embeds
        );
    }
}

let unpatchOpenLazy:
    (() => void) | null = null;

export default {
    onLoad() {
        unpatchOpenLazy = before(
            "openLazy",
            ActionSheet,
            ([comp, args, msg]) => {
                if (
                    args !==
                        "MessageLongPressActionSheet" ||
                    !msg?.message
                ) {
                    return;
                }

                const message =
                    msg.message;

                const ids =
                    extractAllMentionIds(
                        message
                    );

                if (ids.length === 0) {
                    return;
                }

                comp.then(
                    (instance: any) => {
                        const unpatch =
                            after(
                                "default",
                                instance,
                                (
                                    _args: any,
                                    component: any
                                ) => {
                                    React.useEffect(
                                        () => () => {
                                            unpatch();
                                        },
                                        []
                                    );

                                    const groups:
                                        any[] =
                                        findInReactTree(
                                            component,
                                            (c: any) =>
                                                Array.isArray(
                                                    c
                                                ) &&
                                                c[0]?.type
                                                    ?.name ===
                                                    "ActionSheetRowGroup"
                                        );

                                    if (
                                        !groups?.length
                                    ) {
                                        return;
                                    }

                                    const fixButton =
                                        React.createElement(
                                            ActionSheetRow,
                                            {
                                                label:
                                                    ids.length ===
                                                    1
                                                        ? "Fix Unknown Mention"
                                                        : `Fix ${ids.length} Unknown Mentions`,

                                                icon: React.createElement(
                                                    ActionSheetRow.Icon,
                                                    {
                                                        source:
                                                            MentionIcon
                                                    }
                                                ),

                                                onPress:
                                                    () => {
                                                        ActionSheet.hideActionSheet();

                                                        fixUnknownMentions(
                                                            message
                                                        );
                                                    }
                                            }
                                        );

                                    let inserted =
                                        false;

                                    for (
                                        let gi = 0;
                                        gi <
                                        groups.length;
                                        gi++
                                    ) {
                                        const groupChildren:
                                            any[] =
                                            findInReactTree(
                                                groups[
                                                    gi
                                                ],
                                                (c: any) =>
                                                    Array.isArray(
                                                        c
                                                    ) &&
                                                    c.some(
                                                        (
                                                            child: any
                                                        ) =>
                                                            child
                                                                ?.type
                                                                ?.name ===
                                                            "ActionSheetRow"
                                                    )
                                            );

                                        if (
                                            !groupChildren
                                        ) {
                                            continue;
                                        }

                                        groupChildren.unshift(
                                            fixButton
                                        );

                                        inserted =
                                            true;

                                        break;
                                    }

                                    if (
                                        !inserted
                                    ) {
                                        groups.unshift(
                                            React.createElement(
                                                ActionSheetRow.Group,
                                                null,
                                                fixButton
                                            )
                                        );
                                    }
                                }
                            );
                    }
                );
            }
        );
    },

    onUnload() {
        unpatchOpenLazy?.();
        unpatchOpenLazy = null;
    }
};