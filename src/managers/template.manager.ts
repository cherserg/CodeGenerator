// src/managers/template.manager.ts

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

  public async generate(request: IGenerationRequest): Promise<void> {
    const { template, entity, script, output } = request;

    // Если сущности нет — работаем с пустым набором переменных
    const entityVars = entity?.variables ?? {};

    // Получаем документ, уже включающий шапку
    const document = this.docService.generate(
      template,
      entityVars,
      script.variables
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
      output
    );

    await this.fileService.save(outDir, fileName, document);
  }
}
