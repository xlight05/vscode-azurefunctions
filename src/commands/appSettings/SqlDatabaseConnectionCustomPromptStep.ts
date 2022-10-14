import { AzureWizardPromptStep } from '@microsoft/vscode-azext-utils';
import { ConnectionType } from '../../constants';
import { ISqlDatabaseConnectionWizardContext } from './ISqlDatabaseConnectionWizardContext';

export class SqlDatabaseConnectionCustomPromptStep<T extends ISqlDatabaseConnectionWizardContext> extends AzureWizardPromptStep<T> {
    public async prompt(context: T): Promise<void> {
        context.nonAzureSqlConnection = 'fakestring';
    }

    public shouldPrompt(context: T): boolean {
        return !context.nonAzureSqlConnection && context.sqlDbConnectionType === ConnectionType.NonAzure;
    }
}
