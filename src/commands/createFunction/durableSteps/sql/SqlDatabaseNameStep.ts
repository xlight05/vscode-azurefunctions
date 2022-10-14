import { AzureWizardPromptStep } from '@microsoft/vscode-azext-utils';
import { ConnectionType } from '../../../../constants';
import { ISqlDatabaseConnectionWizardContext } from '../../../appSettings/ISqlDatabaseConnectionWizardContext';

export class SqlDatabaseNameStep<T extends ISqlDatabaseConnectionWizardContext> extends AzureWizardPromptStep<T> {
    public async prompt(context: T): Promise<void> {
        context.newSqlDatabaseName = 'mynewsqldatabasename';
    }

    public shouldPrompt(context: T): boolean {
        return !context.newSqlDatabaseName && context.sqlDbConnectionType === ConnectionType.Azure;
    }
}
