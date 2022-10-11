/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from '@azure/arm-appservice';
import { ParsedSite } from '@microsoft/vscode-azext-azureappservice';
import { IActionContext } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { ConnectionKey, ConnectionKeyValues, DurableBackend, DurableBackendValues, extensionVersionKey, local, localEventHubsEmulatorConnectionString, localStorageEmulatorConnectionString, ProjectLanguage, remote, runFromPackageKey, workerRuntimeKey } from '../../constants';
import { ext } from '../../extensionVariables';
import { getLocalConnectionString } from '../../funcConfig/local.settings';
import { FuncVersion, tryParseFuncVersion } from '../../FuncVersion';
import { localize } from '../../localize';
import { SlotTreeItem } from '../../tree/SlotTreeItem';
import { isKnownWorkerRuntime, promptToUpdateDotnetRuntime, tryGetFunctionsWorkerRuntimeForProject } from '../../vsCodeConfig/settings';

/**
 * Just putting a few booleans in an object to avoid ordering mistakes if we passed them as individual params
 */
type VerifyAppSettingBooleans = { doRemoteBuild: boolean | undefined; isConsumption: boolean };

export async function verifyAppSettings(context: IActionContext, node: SlotTreeItem, projectPath: string | undefined, version: FuncVersion, language: ProjectLanguage, bools: VerifyAppSettingBooleans, durableStorageType: DurableBackendValues | undefined): Promise<void> {
    const client = await node.site.createClient(context);
    const appSettings: StringDictionary = await client.listApplicationSettings();
    if (appSettings.properties) {
        const remoteRuntime: string | undefined = appSettings.properties[workerRuntimeKey];
        await verifyVersionAndLanguage(context, projectPath, node.site.fullName, version, language, appSettings.properties);

        // update the settings if the remote runtime was changed
        let updateAppSettings: boolean = appSettings.properties[workerRuntimeKey] !== remoteRuntime;
        if (node.site.isLinux) {
            const remoteBuildSettingsChanged = verifyLinuxRemoteBuildSettings(context, appSettings.properties, bools);
            updateAppSettings ||= remoteBuildSettingsChanged;
        } else {
            updateAppSettings ||= verifyRunFromPackage(context, node.site, appSettings.properties);
        }

        updateAppSettings ||= await verifyConnectionStrings(context, durableStorageType, appSettings.properties, projectPath);

        if (updateAppSettings) {
            await client.updateApplicationSettings(appSettings);
            // if the user cancels the deployment, the app settings node doesn't reflect the updated settings
            await node.appSettingsTreeItem?.refresh(context);
        }
    }
}

export async function verifyConnectionStrings(context: IActionContext, durableStorageType: DurableBackendValues | undefined, remoteProperties: { [propertyName: string]: string }, projectPath: string | undefined): Promise<boolean> {
    const overwrite: boolean = await shouldOverwrite(context);
    let didChange: boolean = false;
    switch (durableStorageType) {
        case DurableBackend.Netherite:
            const localEventHubsConnection: string | undefined = await getLocalConnectionString(context, ConnectionKey.EventHub, projectPath);
            didChange ||= await updateConnectionStringIfNeeded(context, remoteProperties, ConnectionKey.EventHub, localEventHubsConnection, overwrite, localEventHubsConnection === localEventHubsEmulatorConnectionString);
            break;
        case DurableBackend.SQL:
            break;
        case DurableBackend.Storage:
        default:
    }

    const localStorageConnection: string | undefined = await getLocalConnectionString(context, ConnectionKey.Storage, projectPath);
    didChange ||= await updateConnectionStringIfNeeded(context, remoteProperties, ConnectionKey.Storage, localStorageConnection, overwrite, localStorageConnection === localStorageEmulatorConnectionString);

    return didChange;
}

export async function shouldOverwrite(context: IActionContext): Promise<boolean> {
    const items: vscode.MessageItem[] = [{ title: local }, { title: remote }];
    const result: string | undefined = (await context.ui.showWarningMessage(localize('selectOverwriteBehavior', 'Discrepancies between local and remote settings may exist, which environment settings are more current?'), { modal: true }, ...items)).title;
    if (result === 'Local') {
        return true;
    } else {
        return false;
    }
}

export async function updateConnectionStringIfNeeded(context: IActionContext, remoteProperties: { [propertyName: string]: string }, propertyName: ConnectionKeyValues, newValue: string | undefined, overwrite: boolean, isEmulator: boolean): Promise<boolean> {
    const remoteValue = remoteProperties[propertyName];
    if (!!newValue && !isEmulator && overwrite) {
        remoteProperties[propertyName] = newValue;
    } else if (!remoteValue && !!newValue && !isEmulator) {
        // Regardless of overwrite flag, if there is a local settings value (that isn't an emulator) and no remote value, we will go ahead and match it
        remoteProperties[propertyName] = newValue;
    } else {
        return false;
    }

    context.telemetry.properties[`update${propertyName}`] = String(true);
    return true;
}

export async function verifyVersionAndLanguage(context: IActionContext, projectPath: string | undefined, siteName: string, localVersion: FuncVersion, localLanguage: ProjectLanguage, remoteProperties: { [propertyName: string]: string }): Promise<void> {
    const rawAzureVersion: string = remoteProperties[extensionVersionKey];
    const azureVersion: FuncVersion | undefined = tryParseFuncVersion(rawAzureVersion);
    const azureWorkerRuntime: string | undefined = remoteProperties[workerRuntimeKey];

    // Since these are coming from the user's app settings we want to be a bit careful and only track if it's in an expected format
    context.telemetry.properties.remoteVersion = azureVersion || 'Unknown';
    context.telemetry.properties.remoteRuntimeV2 = isKnownWorkerRuntime(azureWorkerRuntime) ? azureWorkerRuntime : 'Unknown';

    const localWorkerRuntime: string | undefined = await tryGetFunctionsWorkerRuntimeForProject(context, localLanguage, projectPath);

    if (localVersion !== FuncVersion.v1 && isKnownWorkerRuntime(azureWorkerRuntime) && isKnownWorkerRuntime(localWorkerRuntime) && azureWorkerRuntime !== localWorkerRuntime) {
        const incompatibleRuntime: string = localize('incompatibleRuntime', 'The remote runtime "{0}" for function app "{1}" does not match your local runtime "{2}".', azureWorkerRuntime, siteName, localWorkerRuntime);
        if (promptToUpdateDotnetRuntime(azureWorkerRuntime, localWorkerRuntime)) {
            const updateAndDeploy = { title: localize('updateAndDeploy', 'Update and Deploy') };
            await context.ui.showWarningMessage(
                `${incompatibleRuntime} The remote runtime version needs to be updated in order for this project to deploy successfully.`,
                { modal: true, stepName: 'incompatibleDotnetRuntime' }, updateAndDeploy);

            remoteProperties[workerRuntimeKey] = localWorkerRuntime as string;
        } else {
            throw new Error(incompatibleRuntime);
        }
    }

    if (!!rawAzureVersion && azureVersion !== localVersion) {
        const message: string = localize('incompatibleVersion', 'The remote version "{0}" for function app "{1}" does not match your local version "{2}".', rawAzureVersion, siteName, localVersion);
        const deployAnyway: vscode.MessageItem = { title: localize('deployAnyway', 'Deploy Anyway') };
        const learnMoreLink: string = 'https://aka.ms/azFuncRuntime';
        // No need to check result - cancel will throw a UserCancelledError
        await context.ui.showWarningMessage(message, { modal: true, learnMoreLink, stepName: 'incompatibleVersion' }, deployAnyway);
    }
}

/**
 * Automatically set to 1 on windows plans because it has significant perf improvements
 * https://github.com/microsoft/vscode-azurefunctions/issues/1465
 */
function verifyRunFromPackage(context: IActionContext, site: ParsedSite, remoteProperties: { [propertyName: string]: string }): boolean {
    const shouldAddSetting: boolean = !remoteProperties[runFromPackageKey];
    if (shouldAddSetting) {
        remoteProperties[runFromPackageKey] = '1';
        ext.outputChannel.appendLog(localize('addedRunFromPackage', 'Added app setting "{0}" to improve performance of function app. Learn more here: https://aka.ms/AA8vxc0', runFromPackageKey), { resourceName: site.fullName });
    }

    context.telemetry.properties.addedRunFromPackage = String(shouldAddSetting);
    return shouldAddSetting;
}

function verifyLinuxRemoteBuildSettings(context: IActionContext, remoteProperties: { [propertyName: string]: string }, bools: VerifyAppSettingBooleans): boolean {
    let hasChanged: boolean = false;

    const keysToRemove: string[] = [];

    if (bools.doRemoteBuild) {
        keysToRemove.push(
            'WEBSITE_RUN_FROM_ZIP',
            'WEBSITE_RUN_FROM_PACKAGE'
        );
    }

    if (!bools.isConsumption) {
        const dedicatedBuildSettings: [string, string][] = [
            ['ENABLE_ORYX_BUILD', 'true'],
            ['SCM_DO_BUILD_DURING_DEPLOYMENT', '1'],
            ['BUILD_FLAGS', 'UseExpressBuild'],
            ['XDG_CACHE_HOME', '/tmp/.cache']
        ];

        for (const [key, value] of dedicatedBuildSettings) {
            if (!bools.doRemoteBuild) {
                keysToRemove.push(key);
            } else if (remoteProperties[key] !== value) {
                remoteProperties[key] = value;
                hasChanged = true;
            }
        }
    }

    for (const key of keysToRemove) {
        if (remoteProperties[key]) {
            delete remoteProperties[key];
            hasChanged = true;
        }
    }

    context.telemetry.properties.linuxBuildSettingsChanged = String(hasChanged);
    return hasChanged;
}

