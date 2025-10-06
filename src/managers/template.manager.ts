import { IGenerationRequest } from "../interfaces/entities/gen-request.interface";
import { DocumentGeneratorService } from "../services/document-generator.service";
import { PathCreatorService } from "../services/path-creator.service";
import { NameBuilderService } from "../services/name-builder.service";
import { FileCreatorService } from "../services/file-creator.service";
import { TemplatePartRepository } from "../repositories/template-part.repository";

export class TemplateManager {
  private docService: DocumentGeneratorService;
  private pathService = new PathCreatorService();
  private nameService = new NameBuilderService();
  private fileService = new FileCreatorService();

  constructor(partRepo: TemplatePartRepository) {
    this.docService = new DocumentGeneratorService(partRepo);
  }

  public async generate(
    req: IGenerationRequest,
    workspaceRoot: string
  ): Promise<void> {
    const { template, entity, script, output, userVariables } = req;

    const entityVars = entity?.variables ?? {};
    const docBody = this.docService.generate(
      template,
      entityVars,
      script.variables,
      userVariables
    );

    const outDir = this.pathService.generate(
      output,
      entityVars,
      script.variables
    );
    const fileName = this.nameService.generate(
      entityVars,
      script.variables,
      template,
      output,
      userVariables
    );

    await this.fileService.save(outDir, fileName, docBody, workspaceRoot);
  }
}
